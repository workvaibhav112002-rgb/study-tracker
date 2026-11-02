-- Customizable mistake journal: user-defined categories stored as tags.

ALTER TABLE settings ADD COLUMN journal_config JSONB NULL;
ALTER TABLE projects ADD COLUMN journal_config JSONB NULL;

ALTER TABLE mistakes
    ADD COLUMN tags  JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN extra JSONB NOT NULL DEFAULT '{}';

-- Carry the fixed exam columns over into tags.
UPDATE mistakes SET tags = jsonb_strip_nulls(jsonb_build_object(
    'subject', NULLIF(subject, ''),
    'topic', NULLIF(pattern, ''),
    'mistake_type', CASE root_cause
        WHEN 'concept' THEN 'didnt_know'
        WHEN 'procedural' THEN 'careless'
        WHEN 'time_ego' THEN 'time'
    END
));

DROP INDEX IF EXISTS mistakes_user_pattern_idx;
ALTER TABLE mistakes DROP COLUMN subject, DROP COLUMN pattern, DROP COLUMN root_cause;
CREATE INDEX mistakes_tags_idx ON mistakes USING GIN (tags);
