-- Add creation wizard stage tracking to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS creation_stage TEXT NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS concept_topic TEXT NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS concept_angle TEXT NULL;
