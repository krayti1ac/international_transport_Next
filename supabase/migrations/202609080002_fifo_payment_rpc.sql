-- ============================================================================
-- Migration: 20260908_fifo_payment_rpc.sql
-- Description: Atomic FIFO Payment Processing Stored Procedure (RPC)
-- ============================================================================

-- Ensure allocations table exists
CREATE TABLE IF NOT EXISTS payment_invoice_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_allocations_payment_id ON payment_invoice_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice_id ON payment_invoice_allocations(invoice_id);

-- Enable RLS
ALTER TABLE payment_invoice_allocations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_invoice_allocations' AND policyname = 'allow_authenticated_all_allocations'
    ) THEN
        CREATE POLICY allow_authenticated_all_allocations ON payment_invoice_allocations
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Drop function if exists to allow clean recreate
DROP FUNCTION IF EXISTS process_fifo_payment(BIGINT, NUMERIC, VARCHAR, VARCHAR, BIGINT, BIGINT, TEXT, TEXT);

-- Create atomic FIFO payment processor
CREATE OR REPLACE FUNCTION process_fifo_payment(
    p_client_id BIGINT,
    p_amount NUMERIC,
    p_currency VARCHAR DEFAULT 'MAD',
    p_payment_method VARCHAR DEFAULT 'bank_transfer',
    p_bank_account_id BIGINT DEFAULT NULL,
    p_cash_box_id BIGINT DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id BIGINT;
    v_remaining_payment NUMERIC(15, 2) := p_amount;
    v_total_allocated NUMERIC(15, 2) := 0;
    v_unallocated_credit NUMERIC(15, 2) := 0;
    v_affected_invoices_count INT := 0;
    v_invoice RECORD;
    v_inv_total NUMERIC(15, 2);
    v_inv_paid NUMERIC(15, 2);
    v_due_on_inv NUMERIC(15, 2);
    v_allocated_amount NUMERIC(15, 2);
    v_new_paid NUMERIC(15, 2);
    v_new_status VARCHAR(20);
    v_allocations_json JSONB := '[]'::JSONB;
BEGIN
    -- Validate input amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'المبلغ المدفوع يجب أن يكون أكبر من الصفر';
    END IF;

    -- 1. Insert Payment Record
    INSERT INTO payments (
        amount,
        currency,
        method,
        bank_account_id,
        reference,
        notes,
        status,
        notify_client
    ) VALUES (
        p_amount,
        p_currency,
        p_payment_method,
        CASE WHEN p_bank_account_id IS NOT NULL THEN p_bank_account_id::TEXT ELSE NULL END,
        p_reference,
        COALESCE(p_notes, 'دفعة بنظام FIFO للعميل #' || p_client_id),
        'completed',
        false
    )
    RETURNING id INTO v_payment_id;

    -- 2. Loop through client's unpaid/partially paid/overdue invoices ordered by oldest issue_date, id
    FOR v_invoice IN
        SELECT id, invoice_number, total_amount, paid_amount, status
        FROM invoices
        WHERE (client_id = p_client_id::TEXT OR client_id = p_client_id::VARCHAR)
          AND status IN ('unpaid', 'partially_paid', 'overdue')
        ORDER BY issue_date ASC NULLS LAST, id ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining_payment <= 0.00;

        v_inv_total := COALESCE(v_invoice.total_amount::NUMERIC, 0);
        v_inv_paid := COALESCE(v_invoice.paid_amount::NUMERIC, 0);
        v_due_on_inv := GREATEST(0, v_inv_total - v_inv_paid);

        IF v_due_on_inv > 0 THEN
            IF v_remaining_payment >= v_due_on_inv THEN
                v_allocated_amount := v_due_on_inv;
                v_new_paid := v_inv_total;
                v_new_status := 'paid';
                v_remaining_payment := v_remaining_payment - v_allocated_amount;
            ELSE
                v_allocated_amount := v_remaining_payment;
                v_new_paid := v_inv_paid + v_allocated_amount;
                v_new_status := 'partially_paid';
                v_remaining_payment := 0;
            END IF;

            v_total_allocated := v_total_allocated + v_allocated_amount;
            v_affected_invoices_count := v_affected_invoices_count + 1;

            -- Record individual allocation
            INSERT INTO payment_invoice_allocations (
                payment_id,
                invoice_id,
                allocated_amount
            ) VALUES (
                v_payment_id,
                v_invoice.id,
                v_allocated_amount
            );

            -- Update invoice status and paid amount
            UPDATE invoices
            SET paid_amount = v_new_paid::TEXT,
                status = v_new_status
            WHERE id = v_invoice.id;

            -- Append to result JSON array
            v_allocations_json := v_allocations_json || jsonb_build_object(
                'invoiceId', v_invoice.id,
                'invoiceNumber', COALESCE(v_invoice.invoice_number, '#' || v_invoice.id::TEXT),
                'allocatedAmount', v_allocated_amount,
                'newPaidAmount', v_new_paid,
                'newStatus', v_new_status
            );
        END IF;
    END LOOP;

    v_unallocated_credit := GREATEST(0, v_remaining_payment);

    -- 3. Record Treasury Transaction (Income)
    INSERT INTO treasury_transactions (
        type,
        amount,
        currency,
        cash_box_id,
        bank_account_id,
        description,
        reference,
        reconciliation_status
    ) VALUES (
        'income',
        p_amount,
        p_currency,
        p_cash_box_id,
        p_bank_account_id,
        'تحصيل دفعة عميل #' || p_client_id || ' (FIFO) - مرجع: ' || COALESCE(p_reference, 'بدون'),
        COALESCE(p_reference, 'PAY-' || v_payment_id::TEXT),
        'cleared'
    );

    -- 4. Update Bank Account or Cash Box balance
    IF p_bank_account_id IS NOT NULL THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) + p_amount
        WHERE id = p_bank_account_id;
    END IF;

    IF p_cash_box_id IS NOT NULL THEN
        UPDATE cash_boxes
        SET current_balance = COALESCE(current_balance, 0) + p_amount
        WHERE id = p_cash_box_id;
    END IF;

    -- Return JSON payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'totalAllocated', v_total_allocated,
        'unallocatedCredit', v_unallocated_credit,
        'affectedInvoicesCount', v_affected_invoices_count,
        'allocations', v_allocations_json
    );
EXCEPTION WHEN OTHERS THEN
    -- In PostgreSQL, any unhandled exception inside a function automatically rolls back the transaction
    RAISE EXCEPTION 'فشل معالجة دفعة FIFO: %', SQLERRM;
END;
$$;
