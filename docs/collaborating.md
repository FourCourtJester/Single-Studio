# Working with other people

By default a studio is one person at one machine, and needs nothing but a browser.
This is about the other case: a producer on scores, somebody else on lower thirds,
you on the stream.

Their edits appear on your board. Yours appear on theirs. **Your graphics keep
working even when the connection does not** — if the network drops mid-show, every
machine carries on from its own copy and they reconcile when it comes back. Nothing
blanks on air.

---

## What an operator does

Paste a link into an OBS custom browser dock.

That is the whole of it. No account, no key to type, no settings screen. OBS
remembers a dock's URL, so it is a once-ever step.

You get that link from the **Collaborate** dialog on your own board.

## What you do, once

You need a free Supabase project. It takes about three minutes, we never see it,
and there is nothing to install or deploy.

1. Go to [supabase.com](https://supabase.com) and sign in. The free tier is enough,
   and it does not ask for a card.
2. Press **New project**. Any name, any region near you, any database password —
   you will never need it.
3. Wait a minute or two while it builds.
4. Open **Project Settings → API**.
5. Copy the **Project URL** and the key labelled **`anon` `public`**.

Then, on your board:

6. Press **Collaborate** in the header.
7. Paste both values, pick a room name, press **Go**.

The page reloads and you are connected. That is it — no tables to create, no
policies to configure, no code.

### The room name is the password

Anyone with the project URL, the key and the room name can join. The first two are
public by design, so **the room name is what keeps a show private.** Use something
nobody would guess — `friday-night` is a bad room name, `friday-night-7x2k9` is a
fine one.

If a room name gets out, move to a new one and send everyone a fresh link. That
takes ten seconds and costs nothing.

### Why the page reloads

Because a dock's URL is the only thing OBS remembers. Once the room is in the URL,
your dock is self-contained: it survives a reload, moves to another machine, and is
already the shape of an invite link. Storing it only in the browser would mean
losing it the next time somebody re-added the dock.

---

## Why Supabase

The rule this had to satisfy: **we hold no keys, and you deploy nothing.** A studio
is static files on GitHub Pages, so anything that carries edits between machines
has to work from a browser with no backend at all — and the person who wrote the
framework must never hold a credential for your show.

That rules almost everything out.

| Option                   | Why not                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Realtime** ✅ | Broadcast works straight from the browser with a project's public key. Free tier is far more than a production needs.         |
| Pusher                   | Sending between clients needs private channels, which need a server to authorise them. A backend, which is the thing avoided. |
| Trystero / WebRTC        | Genuinely needs nothing — but WebRTC cannot run in a `SharedWorker`, and the entire store lives in one.                       |
| A relay we host          | Then we hold the keys, and your show depends on us staying in business.                                                       |

### Is the key really safe in a URL?

Yes. Supabase's `anon` key is designed to sit in the page of a public website —
that is its purpose. It identifies the project, not a person. Every Supabase app
you have ever used ships it to the browser.

### What it costs

Nothing, realistically. A busy board is a few messages a second; the free tier
allows two hundred simultaneous connections and millions of messages a month. A
four-person production will not come close.

### What it gives up

There is no server holding your show, which is the trade for having nothing to
deploy. So: **an operator who opens their board while every other machine is off
sees an empty board** until somebody comes up.

During a broadcast that cannot happen, because the machine running OBS is on by
definition. It only bites if somebody sets up early, alone. Tell them to open it
once you are up.

If that matters to you — a production where operators prepare hours ahead — run
[your own relay](../packages/relay/README.md) instead. One command to deploy, it
holds the document, and the Collaborate dialog takes its address the same way.

---

## Who is here, and who is editing what

Once connected, the header shows the room and how many people are in it. Put your
name in the **Operators** panel and everyone sees it.

A field somebody else has open is marked with their name. It is a **warning, not a
lock** — two people in one field is a conversation to have, and a lock is something
that strands a board when somebody closes their laptop mid-edit.

## When something is wrong

| What you see        | What it means                                                                           |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Connected**       | Working. Edits are reaching everyone.                                                   |
| **Connecting…**     | Trying. Your graphics are fine; other people are not seeing your edits yet.             |
| **Offline**         | Cannot reach the project. Check the URL and key. Your graphics are still fine.          |
| No indicator at all | Collaboration was never set up on this machine. That is the normal one-operator studio. |

Nothing on this list stops the broadcast. That is deliberate, and it is the reason
the store works the way it does: a relay is something a show can lose without the
audience ever knowing.
