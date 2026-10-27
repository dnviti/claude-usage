// Claude Usage - indicatore nella barra in alto di GNOME Shell.
//
// Non legge credenziali e non fa chiamate di rete: esegue
// `claude-usage --limits --json` (cercato nel PATH, di norma /usr/bin)
// ogni 30 minuti (in modo asincrono) e mostra il risultato. Tutta la
// logica sta nello script.

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const INTERVAL_S = 1800;
const BAR_WIDTH = 260; // px logici (St applica il fattore di scala)
const DESKTOP_ID = 'io.github.dnviti.ClaudeUsage.desktop';

const ClaudeUsageIndicator = GObject.registerClass(
class ClaudeUsageIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'Claude Usage');
        this._ext = ext;
        this._script = GLib.find_program_in_path('claude-usage') ?? '/usr/bin/claude-usage';
        this._busy = false;
        this._proc = null;
        this._cancellable = null;
        this._destroyed = false;

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(`${ext.path}/icons/claude-usage-symbolic.svg`),
            style_class: 'system-status-icon',
        }));
        this._panelLabel = new St.Label({
            text: '…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-usage-panel-label',
        });
        box.add_child(this._panelLabel);
        this.add_child(box);

        this._rowsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._rowsSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._costItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this.menu.addMenuItem(this._costItem);
        this._updatedItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._updatedItem.label.add_style_class_name('claude-usage-dim');
        this.menu.addMenuItem(this._updatedItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Aggiorna ora', () => this._refresh());
        this.menu.addAction('Apri finestra', () => this._openApp());
        this.menu.addAction('Esci', () => this._ext.quitIndicator());

        this._addMessage('Caricamento…', 'claude-usage-dim');
        this._refresh();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, INTERVAL_S, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _refresh() {
        if (this._busy || this._destroyed)
            return;
        this._busy = true;
        this._cancellable = new Gio.Cancellable();
        try {
            this._proc = Gio.Subprocess.new(
                [this._script, '--limits', '--json'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            const [stdout] = await this._proc.communicate_utf8_async(null, this._cancellable);
            if (this._destroyed)
                return;
            this._render(JSON.parse(stdout));
        } catch (e) {
            if (this._destroyed || e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            this._panelLabel.text = '!';
            this._rowsSection.removeAll();
            this._addMessage(`Errore: ${e.message}`, 'claude-usage-error');
        } finally {
            this._busy = false;
            this._proc = null;
            this._cancellable = null;
        }
    }

    _render(d) {
        this._rowsSection.removeAll();
        const rows = Array.isArray(d.rows) ? d.rows : [];
        const session = rows.find(r => r.kind === 'session');

        const pct = d.session_percent;
        this._panelLabel.text = typeof pct === 'number' ? `${Math.round(pct)}%` : '–';
        for (const lvl of ['warning', 'critical'])
            this._panelLabel.remove_style_class_name(`claude-usage-${lvl}`);
        if (session && session.level !== 'normal')
            this._panelLabel.add_style_class_name(`claude-usage-${session.level}`);
        if (d.error && !d.ok)
            this._panelLabel.text += '!';

        if (d.error)
            this._addMessage(d.error, 'claude-usage-error');
        if (!rows.length && !d.error)
            this._addMessage('Nessun limite riportato dal server.', 'claude-usage-dim');

        let group = null;
        for (const r of rows) {
            if (r.group_label !== group) {
                group = r.group_label;
                const h = new PopupMenu.PopupMenuItem(group, {reactive: false});
                h.label.add_style_class_name('claude-usage-heading');
                this._rowsSection.addMenuItem(h);
            }
            this._rowsSection.addMenuItem(this._makeRow(r));
        }

        this._costItem.label.text = `Costo stimato oggi: ${d.today_cost_text ?? 'n/d'}`;
        if (!d.updated_text)
            this._updatedItem.label.text = 'Nessun dato';
        else if (d.ok)
            this._updatedItem.label.text = `Aggiornato alle ${d.updated_text}`;
        else
            this._updatedItem.label.text = `Dati non aggiornati (ultimi alle ${d.updated_text})`;
    }

    _makeRow(r) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const vbox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            style_class: 'claude-usage-row',
        });
        const top = new St.BoxLayout({x_expand: true});
        top.add_child(new St.Label({text: r.label ?? '', x_expand: true}));
        top.add_child(new St.Label({text: r.percent_text ?? '', style_class: 'claude-usage-pct'}));
        vbox.add_child(top);

        const frac = Math.min(Math.max(Number(r.percent) || 0, 0), 100) / 100;
        const trough = new St.Widget({
            style_class: 'claude-usage-trough',
            style: `width: ${BAR_WIDTH}px;`,
            layout_manager: new Clutter.BinLayout(),
        });
        trough.add_child(new St.Widget({
            style_class: `claude-usage-fill claude-usage-fill-${r.level ?? 'normal'}`,
            style: `width: ${Math.round(BAR_WIDTH * frac)}px;`,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
        }));
        vbox.add_child(trough);

        if (r.detail) {
            const det = new St.Label({text: r.detail, style_class: 'claude-usage-detail'});
            vbox.add_child(det);
        }
        item.add_child(vbox);
        return item;
    }

    _addMessage(text, cls) {
        const item = new PopupMenu.PopupMenuItem(text, {reactive: false});
        item.label.add_style_class_name(cls);
        item.label.clutter_text.line_wrap = true;
        this._rowsSection.addMenuItem(item);
    }

    _openApp() {
        const app = Shell.AppSystem.get_default().lookup_app(DESKTOP_ID);
        if (app) {
            app.activate();
            return;
        }
        try {
            Gio.Subprocess.new([this._script], Gio.SubprocessFlags.NONE);
        } catch (e) {
            Main.notifyError('Claude Usage', `Impossibile aprire la finestra: ${e.message}`);
        }
    }

    destroy() {
        this._destroyed = true;
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        this._cancellable?.cancel();
        this._proc?.force_exit();
        super.destroy();
    }
});

export default class ClaudeUsageExtension extends Extension {
    enable() {
        this._indicator = new ClaudeUsageIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    // "Esci": nasconde l'indicatore fino al prossimo accesso (o disabilita/riabilita).
    quitIndicator() {
        this._indicator?.destroy();
        this._indicator = null;
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
