export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reconcileNpcEvents } = await import('./lib/npc-events');
  const globalState = globalThis as typeof globalThis & { simusEventTicker?: ReturnType<typeof setInterval> };
  if (globalState.simusEventTicker) return;
  let busy = false;
  // Each process may tick; session row locks serialize all durable transitions.
  globalState.simusEventTicker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await reconcileNpcEvents(); }
    catch (error) { console.error('NPC event ticker failed', error); }
    finally { busy = false; }
  }, 250);
  globalState.simusEventTicker.unref();
}
