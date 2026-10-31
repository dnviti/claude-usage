%global uuid claude-usage@dnviti.github.io
%global appid io.github.dnviti.ClaudeUsage

Name:           claude-usage
Version:        0.1.2
Release:        1%{?dist}
Summary:        Claude Code usage statistics and subscription limits for GNOME

License:        MIT
URL:            https://github.com/dnviti/claude-usage
Source0:        %{url}/archive/v%{version}/%{name}-%{version}.tar.gz

BuildArch:      noarch
BuildRequires:  desktop-file-utils

Requires:       python3
Requires:       python3-gobject
Requires:       gtk4
Requires:       libadwaita
Requires:       gnome-shell

%description
Claude Usage is a GTK4/libadwaita app that reads the local Claude Code
transcripts (~/.claude/projects) and shows token totals, per-model and
per-project breakdowns, a 30-day chart and an estimated cost. It also shows
the Claude subscription limits (5-hour session, weekly) and ships a GNOME
Shell top-bar extension that displays them.

%prep
%autosetup

%build
# Nothing to build.

%install
install -Dpm 0755 claude-usage %{buildroot}%{_bindir}/claude-usage
sed -i '1s|^#!/usr/bin/env python3|#!%{python3}|' %{buildroot}%{_bindir}/claude-usage
install -Dpm 0644 data/%{appid}.desktop %{buildroot}%{_datadir}/applications/%{appid}.desktop
install -d %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/icons
install -pm 0644 extension/%{uuid}/metadata.json \
                 extension/%{uuid}/extension.js \
                 extension/%{uuid}/stylesheet.css \
                 %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/
install -pm 0644 extension/%{uuid}/icons/claude-usage.svg \
                 %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/icons/
install -Dpm 0644 data/icons/hicolor/scalable/apps/%{appid}.svg \
                  %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/%{appid}.svg

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/%{appid}.desktop

%files
%license LICENSE
%doc README.md
%{_bindir}/claude-usage
%{_datadir}/applications/%{appid}.desktop
%{_datadir}/icons/hicolor/scalable/apps/%{appid}.svg
%{_datadir}/gnome-shell/extensions/%{uuid}/

%changelog
* Sat Oct 31 2026 Daniele Viti <8649488+dnviti@users.noreply.github.com> - 0.1.2-1
- Show the weekly percentage in the panel when the 5-hour limit is absent
- Fix a missing session percentage being shown as 0%
- New Claude starburst icon for the panel and the application

* Tue Oct 27 2026 Daniele Viti <8649488+dnviti@users.noreply.github.com> - 0.1.1-1
- Refresh interval raised from 60 seconds to 30 minutes
- Remove the "last updated" status label from the app

* Tue Oct 27 2026 Daniele Viti <8649488+dnviti@users.noreply.github.com> - 0.1.0-1
- Initial release
