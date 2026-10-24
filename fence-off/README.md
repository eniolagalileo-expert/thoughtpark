# Fence Off

A free 2–4 player **dots-and-boxes** game you play with friends on their own phones or laptops.
No accounts, no app, no server to run: one person creates a room, the others join with a
four-letter code, a link, or by scanning the QR code.

**Play it:** https://eniolagalileo-expert.github.io/thoughtpark/fence-off/

## How to play

1. **Take turns.** On your turn, tap the gap between two neighbouring posts to build one fence there.
2. **Claim plots.** If your fence is the fourth side of a plot, the plot is yours and you take another turn.
3. **Watch out.** A plot with three fences is a gift to the next player.
4. **Finish.** When every plot is claimed, most plots wins. Ties are shared.

## How it works

- A single `index.html`: HTML, CSS and vanilla JavaScript, hosted on GitHub Pages.
- Devices talk **peer-to-peer over WebRTC** using [PeerJS](https://peerjs.com/). The host's browser is
  the referee: it validates every move and broadcasts the full game state to everyone, so all
  players always see the same board.
- Rooms are four-letter codes (`fenceoff-v1-ABCD` peer IDs). Public STUN/TURN servers are
  configured so players behind strict NATs can still connect.
- If a player drops, the host marks them "away", skips their turn, and lets them rejoin with the
  same name. Rematches rotate the starting player.
- `?demo=1` renders a sample board locally (used for the screenshot).

## Run locally

Any static server works, for example:

```
python3 -m http.server 8787
```

then open `http://127.0.0.1:8787/` in two browser tabs or on two devices on the same network.
