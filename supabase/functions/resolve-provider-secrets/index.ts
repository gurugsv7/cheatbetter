// @ts-nocheck
// @ts-ignore -- Deno npm specifier is resolved in Supabase Edge runtime
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ResolveRow = {
    token_id: string;
    provider_mode: string;
    gemini_api_key: string | null;
    groq_api_key: string | null;
    azure_api_key: string | null;
    azure_endpoint: string | null;
    azure_deployment: string | null;
    cloud_token: string | null;
    expires_at: string | null;
    metadata: Record<string, unknown> | null;
    max_interviews: number;
    interviews_used: number;
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Supabase service runtime missing env vars' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';

    let bodyToken = '';
    let consume = false;
    try {
        const body = (await req.json().catch(() => ({}))) as { accessToken?: string; consume?: boolean };
        bodyToken = (body.accessToken ?? '').trim();
        consume = Boolean(body.consume);
    } catch {
        bodyToken = '';
        consume = false;
    }

    const accessToken = (bearerToken || bodyToken).trim();
    if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Missing access token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const rpcName = consume ? 'consume_interview_credit' : 'resolve_provider_secrets';
    const { data, error } = await client.rpc(rpcName, {
        access_token: accessToken,
    });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const row = (Array.isArray(data) ? data[0] : data) as ResolveRow | undefined;
    if (!row) {
        return new Response(JSON.stringify({ error: 'Invalid or expired access token' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(
        JSON.stringify({
            success: true,
            data: {
                tokenId: row.token_id,
                providerMode: row.provider_mode,
                geminiApiKey: row.gemini_api_key ?? '',
                groqApiKey: row.groq_api_key ?? '',
                azureApiKey: row.azure_api_key ?? '',
                azureEndpoint: row.azure_endpoint ?? '',
                azureDeployment: row.azure_deployment ?? '',
                cloudToken: row.cloud_token ?? '',
                expiresAt: row.expires_at,
                metadata: row.metadata ?? {},
                maxInterviews: row.max_interviews ?? 0,
                interviewsUsed: row.interviews_used ?? 0,
                interviewsRemaining: Math.max(0, (row.max_interviews ?? 0) - (row.interviews_used ?? 0)),
            },
        }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
    );
});
