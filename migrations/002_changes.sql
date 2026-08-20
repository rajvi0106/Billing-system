-- Phase 3:fix timezone bug period boundaries should be calendar dates, not timestamps
ALTER TABLE invoices ALTER COLUMN period_start TYPE date;
ALTER TABLE invoices ALTER COLUMN period_end TYPE date;

-- Phase 4:link events to the invoice that billed them
ALTER TABLE usage_events ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);

-- Phase 4:distinguish original invoices from corrections
ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'original';
ALTER TABLE invoices ADD COLUMN correction_sequence INTEGER DEFAULT 0;

-- Phase 4:widen uniqueness to allow multiple corrections per period
ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_period_start_period_end_key;
ALTER TABLE invoices ADD CONSTRAINT invoices_unique_period
UNIQUE(customer_id, period_start, period_end, correction_sequence);