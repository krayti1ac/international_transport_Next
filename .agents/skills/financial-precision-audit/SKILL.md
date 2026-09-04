---
name: financial-precision-audit
description: >-
  Audits and enforces the non-negotiable decimal.js rule for all currency, pricing,
  fuel receipts, driver advances, invoices, and accounting calculations in Trans Bodanon TMS.
  Use when writing, refactoring, or reviewing financial code, calculations, or invoices.
---

# Financial Precision Audit (decimal.js)

## The Immutable Rule

**Never use JavaScript native `number` (IEEE 754 float) for currency, price, advance, fuel, or accounting calculations. Always use `decimal.js`.**

```typescript
// CORRECT
import Decimal from 'decimal.js';

const tripPrice = new Decimal(trip.price);
const driverAdvance = new Decimal(advance.amount);
const remainingBalance = tripPrice.minus(driverAdvance).toFixed(2);

// FORBIDDEN - WILL CAUSE REJECTED CODE
const balance = trip.price - advance.amount; // FLOATING POINT PRECISION BUG!
```

## Global Configuration

Ensure `Decimal` is configured with 20 decimal places and half-up rounding:
```typescript
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
```

## Audit Runbook

When implementing or reviewing any financial feature:

1. **Incoming Data Parsing**:
   Immediately wrap numbers or numeric strings from DB or API:
   ```typescript
   const amount = new Decimal(record.amount || 0);
   ```

2. **Math Operations**:
   - Addition: `a.plus(b)`
   - Subtraction: `a.minus(b)`
   - Multiplication: `a.times(b)`
   - Division: `a.dividedBy(b)`

3. **Comparison**:
   - Greater than: `a.greaterThan(b)`
   - Less than or equal: `a.lessThanOrEqualTo(b)`
   - Equals: `a.equals(b)`

4. **UI Output Boundary**:
   Only format to string or number at the final presentation step:
   ```typescript
   amount.toFixed(2) // Returns string e.g. "1500.00"
   ```

## Quick Verification Command

Run this command in the project to search for suspicious arithmetic operations on financial fields:
```powershell
Get-ChildItem -Path src/features/finance,src/features/invoices,src/features/treasury -Recurse -Include *.ts,*.tsx | Select-String -Pattern "price \+|price -|total \+|total -|balance \+|balance -|amount \+|amount -"
```
All such occurrences must be converted to `Decimal` methods.

