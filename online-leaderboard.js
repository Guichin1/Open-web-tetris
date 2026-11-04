import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const SUPABASE_SDK_URL = 'https://esm.sh/@supabase/supabase-js@2';

let clientPromise = null;

export function isOnlineLeaderboardConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function getClient() {
  if (!isOnlineLeaderboardConfigured()) {
    throw new Error('Online leaderboard is not configured.');
  }

  if (!clientPromise) {
    clientPromise = import(SUPABASE_SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
      }))
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}

async function getPlayerId(client) {
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (session) return session.user.id;

  const { data, error: signInError } = await client.auth.signInAnonymously();
  if (signInError) throw signInError;
  if (!data.user) throw new Error('Supabase did not return a player ID.');
  return data.user.id;
}

export async function initializeOnlinePlayer() {
  const client = await getClient();
  return getPlayerId(client);
}

export async function loadOnlineLeaderboard() {
  const client = await getClient();
  const { data, error } = await client
    .from('player_scores')
    .select('player_id,nickname,best_score,updated_at')
    .order('best_score', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(10);

  if (error) throw error;
  return data;
}

export async function submitOnlineScore(nickname, score) {
  const client = await getClient();
  await getPlayerId(client);

  const { error } = await client.rpc('submit_player_score', {
    p_nickname: nickname,
    p_score: score,
  });
  if (error) throw error;
}
