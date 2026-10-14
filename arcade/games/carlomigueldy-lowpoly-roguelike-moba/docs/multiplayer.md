# Multiplayer

## Current model

The game uses PeerJS over WebRTC data channels. There is no custom game server.

- Host creates a room code.
- Joiner connects to the host by room code.
- Host keeps direct connections to peers.
- Clients send movement and cast events.
- Host relays peer events to other peers.

PeerJS still uses its public broker for WebRTC signaling. Gameplay traffic is peer-to-peer after the connection is established.

## Invite methods

- Link: generated with `?join=<ROOM_CODE>`.
- Code: human-readable code such as `BRAVE-FOX-42`.
- QR: generated from the invite link.

## Current synced events

- `join`: player introduction and palette.
- `roster`: current players and wave.
- `pstate`: player position target and HP.
- `pcast`: ability cast event.
- `espawn`: enemy spawn event from host.
- `ehit`: enemy HP update from host.

## Limitations

- Enemy movement is not fully authoritative across peers.
- Projectiles and damage can diverge under latency.
- There is no reconnect flow.
- There is no lobby readiness protocol beyond host clicking Start.
- Room codes depend on PeerJS availability.

## Recommended next steps

1. Make the host authoritative for enemy AI, enemy positions, damage, wave state, and rewards.
2. Add periodic host snapshots:

```json
{
  "t": "snapshot",
  "d": {
    "time": 123.45,
    "wave": 3,
    "players": [],
    "enemies": [],
    "projectiles": []
  }
}
```

3. Clients should interpolate remote snapshots rather than independently simulating enemies.
4. Add room lifecycle messages: `ready`, `start`, `pause`, `restart`, `leave`.
5. Add deterministic seeds for waves and loot choices.
