module.exports = {
    url: process.env.SUPABASE_URL || 'https://vsybqtunyuanxspxhzue.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeWJxdHVueXVhbnhzcHhoenVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk0NjMsImV4cCI6MjA4OTAwNTQ2M30.iAtvMf-fJVXO1_euiNQK-WE1CbH1NSn_Jyx0t5blmBQ',
    resolveSecretsFunction: process.env.SUPABASE_SECRETS_FUNCTION || 'resolve-provider-secrets',
};
