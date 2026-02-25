/** Returns the Supabase Broadcast channel name for a session */
export function getChannelName(sessionId: string): string {
  return `session:${sessionId}`
}
