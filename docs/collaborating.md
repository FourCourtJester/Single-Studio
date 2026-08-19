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
7. Paste both values, pick a room name, leave **This machine runs OBS** ticked,
   press **Go**.

The page reloads and you are connected. That is it — no tables to create, no
policies to configure, no code.

### "This machine runs OBS"

Tick it on the machine going to air, and nowhere else.

Two computers rarely agree about what time it is — a few seconds apart is normal
and nobody notices until it matters. It matters here: if your producer's laptop is
four seconds fast and they start a five-minute break, the break is five minutes on
their screen and five minutes four seconds on air, and every screen in the building
shows it counting down correctly the whole time.

Ticking the box says "this is the clock everyone works to". Other machines quietly
measure how far off they are and correct for it, in both directions — what they
show you, and what they set when they start a timer. Nobody has to change their
system clock, and nobody has to think about it again.

If you leave it unticked everywhere, nothing breaks; timers just go back to
trusting whichever machine started them. If you tick it on two machines, the show
carries on and one of them wins consistently for everybody.

### Your show is encrypted

New shows on Supabase are encrypted by default, and you do not have to do anything
to get it. The **invite link is the key** — it is generated for you, and it sits
after the `#`, which browsers never send to a server. So Supabase carries your show
without being able to read a word of it, and neither can we, and neither can anyone
who works out your room name.

Two things follow from that, and both are worth knowing before you need them:

**Send the link like a password.** Anyone who has it can open your show. That was
always true, but the link is now the whole of the secret rather than half of it, so
treat it the way you would treat a shared login — not a public post.

**To shut somebody out, start a fresh room.** Encryption cannot un-tell someone a
key they already have, so the answer is a room they have no key to. Open
**Collaborate**, press **Shut somebody out — start a fresh room**, then **Move**.
That picks a new room name and a brand new key; your show comes with you, because
it lives on your machine rather than on a server. Send everyone you still want the
new link.

Anyone holding the old link is left in a room with nobody in it. That is the point,
and it is the honest shape of the thing: there is no button that removes one person
from a room while everyone else carries on, because a key that has already been read
cannot be taken back.

If you would rather not encrypt — you are testing, or you want to be able to read
the traffic yourself — untick **Encrypt this show** before pressing Go.

### If you run your own relay instead

Encryption is not offered there, and the reason is the feature you chose it for: a
relay keeps a copy of the show, so an operator can open their board hours before you
are up. It can only do that if it can read the show. The Collaborate dialog greys
the box out and says so.

On a relay, **the room name is what keeps a show private**, together with the
per-operator keys the relay issues. Use something nobody would guess —
`friday-night` is a bad room name, `friday-night-7x2k9` is a fine one.

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

### Is the anon key really safe in a URL?

Yes. Supabase's `anon` key is designed to sit in the page of a public website —
that is its purpose. It identifies the project, not a person. Every Supabase app
you have ever used ships it to the browser.

That is also exactly why shows are encrypted. A public key plus a guessable room
name is a thin thing to rest a production on, so the room key does the actual work
of keeping people out — and unlike the anon key, it never leaves your browser.

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

## Images

**Links can be added by anyone. Files are added on the machine running OBS.**

That is not a rule about who is trusted — it is about where the picture actually is.
A file you drag in from your desktop exists on your computer and nowhere else, so
the machine going to air has nothing to draw. A link is just an address: every
machine fetches it for itself, so it works from anywhere.

So on a machine that is not running OBS, the library offers the URL box and not the
file buttons, and says so. Paste a link and it appears on every board in the show,
ready to use.

Files added on the OBS machine still show up in everyone's list, by name, so a
remote operator can see what is available — but marked **elsewhere** and greyed out,
because their own screen cannot draw them either. Choosing one would put a blank on
air, so the board says which ones those are rather than letting you find out live.

If you need a picture from a remote operator's desktop in the show, the quickest
route is to put it somewhere with a link — any image host, a shared drive with
public link sharing — and paste that.

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
