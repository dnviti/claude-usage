# Claude Usage

A small GNOME app and top-bar extension that show how much you use
[Claude Code](https://claude.com/claude-code): token counts, an estimated cost,
and your Claude subscription limits (5-hour session and weekly windows).

Built with Python, GTK4 and libadwaita. Tested on Fedora 44 with GNOME Shell 50
(Wayland).

## Features

- **Usage statistics** from the local Claude Code transcripts
  (`~/.claude/projects/**/*.jsonl`), de-duplicated per message:
  - totals for today, the last 7 days, the last 30 days and all time
    (messages, input, output, cache write, cache read, estimated cost);
  - breakdowns per model and per project;
  - a 30-day bar chart (cost, total tokens, input+output tokens or messages).
- **Subscription limits**: current 5-hour session, weekly limits and any other
  window the server reports, with progress bars, warning/critical colours and
  reset times. Unknown limit types are shown generically.
- **GNOME Shell extension**: a top-bar indicator with the session percentage;
  its menu lists every limit and today's estimated cost. It refreshes every
  60 seconds and only runs `claude-usage --limits --json`; it never reads
  credentials or talks to the network itself.
- **Command-line modes**:

  ```
  claude-usage                  # open the window
  claude-usage --dump           # print the statistics in the terminal
  claude-usage --limits         # print the subscription limits
  claude-usage --limits --json  # same, as JSON (used by the extension)
  claude-usage --version
  ```

The user interface is currently in Italian.

## Install

Download the RPM from the
[latest release](https://github.com/dnviti/claude-usage/releases/latest) and
install it:

```sh
sudo dnf install ./claude-usage-0.1.0-1.*.noarch.rpm
```

It installs:

- `/usr/bin/claude-usage`
- `/usr/share/applications/io.github.dnviti.ClaudeUsage.desktop`
- `/usr/share/gnome-shell/extensions/claude-usage@dnviti.github.io/`

Then enable the top-bar extension (on Wayland, log out and back in first so
GNOME Shell sees the new extension):

```sh
gnome-extensions enable claude-usage@dnviti.github.io
```

### Build the RPM yourself

```sh
git archive --prefix=claude-usage-0.1.0/ -o ~/rpmbuild/SOURCES/claude-usage-0.1.0.tar.gz v0.1.0
rpmbuild -bb claude-usage.spec
```

## Requirements

- Claude Code, logged in with a Claude.ai account (for the limits);
- Python 3, PyGObject, GTK 4, libadwaita;
- GNOME Shell 50 for the extension.

## Important notes

- **Costs are estimates.** They are computed from the token counts in the local
  transcripts and the list prices in the `PRICES` table at the top of the
  script. They are not a bill: subscriptions, discounts, pricing tiers and
  models missing from the table are not taken into account. Edit the table if
  prices change.
- **The limits endpoint is unofficial and undocumented.** The limits come from
  `https://api.anthropic.com/api/oauth/usage`, the same endpoint Claude Code
  uses for `/usage`. It is not a public API: it may change or stop working at
  any time, and its response format may change without notice.
- **Credentials.** To read the limits the app uses the OAuth access token that
  Claude Code stores in `~/.claude/.credentials.json`. The token is only read:
  it is never refreshed, printed or saved, and it is sent only to
  `api.anthropic.com` (redirects are not followed). Cached limit data (never the
  token) is kept in `$XDG_RUNTIME_DIR/claude-usage-limits.json`, which is
  cleared at logout.
- This project is not affiliated with or endorsed by Anthropic.

## License

[MIT](LICENSE)
