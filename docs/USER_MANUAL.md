# User Manual — Trans Bodanon TMS

**Trans Bodanon — International Transport Management System**
**Version:** 1.0
**Date:** September 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Accessing the System](#2-accessing-the-system)
3. [Secretary Workflows](#3-secretary-workflows)
4. [Driver Workflows (PWA)](#4-driver-workflows-pwa)
5. [Admin Workflows](#5-admin-workflows)
6. [Quick Reference](#6-quick-reference)

---

## 1. Introduction

Welcome to **Trans Bodanon**, the transport management system for international freight operations.

The system has three user roles:

| Role | What They Do |
|------|-------------|
| **Admin (المدير)** | Full system access: fleet, finance, payroll, reports |
| **Secretary (السكرتيرة)** | Trip creation, invoicing, treasury, client management |
| **Driver (السائق)** | View assigned trips, request advances, scan fuel receipts, sign E-POD |

---

## 2. Accessing the System

1. Open your browser and navigate to the system URL (e.g., `https://transbodanon.vercel.app`).
2. Log in with your email and password.
3. After login, you will be redirected to your role's dashboard.

> **Note:** The system is available as a Progressive Web App (PWA). On mobile, you can "Add to Home Screen" for app-like access.

---

## 3. Secretary Workflows

### 3.1 Create an Outbound Trip

1. Go to **Trips → New Trip**.
2. Fill in:
   - **Client:** Select the client from the dropdown.
   - **Driver & Vehicle:** Assign a driver, truck, and trailer.
   - **Route:** Specify origin and destination.
   - **Dates:** Set departure date, export unloading date, and import loading/unloading dates if applicable.
   - **Price:** Enter the trip price (can be split into export and import legs).
3. Attach relevant documents: CMR export, MRN, ferry details.
4. Click **Create Trip**.

### 3.2 Issue an Advance to a Driver

1. Go to **Trips → Trip Detail** (open the trip you want to fund).
2. Click **Issue Advance**.
3. Enter the amount, currency, and reason.
4. Select the cash box the advance comes from.
5. Click **Confirm**. The advance is immediately deducted from the cash box balance and recorded in the treasury.

### 3.3 Create an Invoice

1. Go to **Invoices → New Invoice**.
2. Select the client and trip order (optional).
3. Enter the invoice amount (HT), TVA rate, and currency (MAD or EUR).
4. The system auto-calculates HT, TVA, and TTC.
5. The bank account is auto-selected based on the client's country (EUR for Europe, MAD otherwise).
6. Click **Generate Invoice** to create the PDF with QR code.

### 3.4 Record a Bulk Payment (FIFO)

1. Go to **Treasury → Receive Payment**.
2. Select the client.
3. Enter the payment amount and method (Cash / Check / Bank Transfer).
4. Select the bank account or cash box receiving the funds.
5. Click **Process Payment (FIFO)**.

**What happens automatically:**
- The payment is applied to the oldest unpaid invoices first (FIFO).
- Invoices are marked `paid` or `partially_paid`.
- A treasury income transaction is recorded.
- The bank/cash box balance is updated.

### 3.5 Settle a Driver's Advance on Return

1. Go to **Driver Settlements**.
2. Select the driver and the completed trip.
3. The system shows:
   - Advance given
   - Extra advances
   - Receipt expenses (from OCR fuel receipts)
   - Driver allowance
   - Amount spent
   - Amount returned
4. Review and confirm the settlement.
5. A treasury expense transaction is created for any difference (refund or additional cost).

### 3.6 Quick-Renew a Fleet Document

1. Go to **Fleet → Documents**.
2. Find the document expiring soon (red expiry indicator).
3. Click **Renew**.
4. Enter the new expiry date and renewal cost.
5. Upload the new document file.
6. Click **Save**. The renewal record is logged for audit.

---

## 4. Driver Workflows (PWA)

### 4.1 View Assigned Trips

1. Open the **Trans Bodanon** app on your phone.
2. Log in with your credentials.
3. Tap **My Tasks** to see all trips assigned to you.
4. Each trip shows: client, route, departure date, and current status.

### 4.2 Request an Emergency Advance

1. In the app, go to **Emergency Advance**.
2. Enter the amount needed and reason.
3. Submit. The secretary will review and approve it.

### 4.3 Scan a Fuel Receipt (OCR)

1. Go to **Fuel Receipt**.
2. Tap **Scan Receipt**.
3. Point your camera at the fuel receipt.
4. The system captures the image and processes it with OCR.
5. Review the extracted data (date, station, amount, liters).
6. Confirm to save the receipt expense linked to your current trip.

### 4.4 Sign the E-POD (Proof of Delivery)

1. When you reach the destination, go to **Delivery**.
2. View the trip details and any attached CMR documents.
3. Tap **Sign Delivery**.
4. Draw your signature on the screen.
5. Optionally take a photo of the goods or CMR document.
6. Submit. The signature and GPS location are recorded.

---

## 5. Admin Workflows

### 5.1 Record a Bulk Payment to Clear Oldest Invoices (FIFO)

Follow the same steps as **Secretary Workflow 3.4**. Admin has full access to all clients and payment methods.

### 5.2 Manage Bank Accounts & Cash Boxes

1. Go to **Treasury → Accounts**.
2. Add, edit, or deactivate bank accounts and cash boxes.
3. Set default accounts for MAD and EUR currencies.
4. View current balances (dynamically calculated).

### 5.3 Run Driver Payroll

1. Go to **HR → Payroll**.
2. Select the driver, month, and year.
3. The system calculates:
   - Base salary
   - Bonus from completed trips
   - Advances to deduct
   - Fines to deduct
4. Click **Pay Salary** to process the payment and create the treasury transaction.

### 5.4 Fleet Document Renewal Alerts

1. Go to **Fleet → Documents**.
2. Use the filter to show **Expiring Soon**.
3. Follow the renewal steps in section 3.6.

### 5.5 View Reports

- **Trip Profitability:** Revenue vs. cost per trip.
- **Fleet Utilization:** Truck and trailer usage rates.
- **Financial Summary:** Total revenue, expenses, and net profit.
- **Driver Performance:** Trips completed, advances taken, fines.

---

## 6. Quick Reference

### Keyboard & Navigation

| Action | How |
|--------|-----|
| Switch language | Use the language toggle in the top bar |
| Open sidebar menu | Hamburger icon (mobile) or always visible (desktop) |
| Log out | Click your profile → Logout |

### Common Abbreviations

| Term | Meaning |
|------|---------|
| CMR | Convention de Marchandises par Route (road waybill) |
| MRN | Movement Reference Number (customs transit) |
| HT | Hors Taxes (amount before tax) |
| TVA | Taxe sur la Valeur Ajoutée (VAT) |
| TTC | Toutes Taxes Comprises (total including tax) |
| E-POD | Electronic Proof of Delivery |
| FIFO | First In, First Out (oldest invoices paid first) |

### Support

For technical issues, contact the system administrator.
For business questions (invoicing, trips, payroll), contact the office.

---

*Document Version: 1.0 | Last Updated: September 2026*
