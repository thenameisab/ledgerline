-- Each SKU states what one billed unit is: "1M tokens", "minute", "message".
ALTER TABLE apis ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'call';
