/**
 * Papa's Pantheon - a spirit assistant for Cookie Clicker's Temple.
 *
 * Rearranging the pantheon is the most expensive routine action in the game.
 * A worship swap costs one drag, and they come back on a punishing curve
 * (minigamePantheon.js, M.logic):
 *
 *     3rd swap back after  1 hour
 *     2nd swap back after  4 hours
 *     1st swap back after 16 hours
 *
 * So going from three swaps to none and back is twenty-one hours. The point of
 * this mod is therefore not convenience - it is not spending swaps you did not
 * mean to spend. Every preset says what it costs before you touch it, the cost
 * is the true minimum rather than "three drags", and nothing is applied that
 * cannot be paid for.
 *
 * See README.md for the presets and the reasoning behind them.
 */
(function () {
'use strict';

var MOD_ID   = 'papas pantheon';
var VERSION  = '1.0';
var PANEL_ID = 'papasPantheonPanel';

var SLOT_NAMES = ['Diamond', 'Ruby', 'Jade'];

/* ------------------------------------------------------------------ *
 * The spirits, and what each one actually costs you
 * ------------------------------------------------------------------ */

/**
 * Every spirit in the game gives with one hand and takes with the other, and
 * the drawback is what makes an arrangement right or wrong for what you are
 * doing. These are the game's own numbers at the Diamond slot; the Ruby and
 * Jade slots are weaker in the same direction.
 */
var GODS = {
	asceticism: {short:'Holobore',  gain:'+15% base CpS',
		cost:'unslots itself and burns every swap if you click a golden cookie'},
	decadence:  {short:'Vomitrax',  gain:'golden cookie effects last +7% longer',
		cost:'buildings give 7% less'},
	ruin:       {short:'Godzamok',  gain:'selling buildings buffs clicking, +1% each for 10s',
		cost:'only useful if you sell and rebuild'},
	ages:       {short:'Cyclius',   gain:'CpS swings between +15% and -15% over 3 hours',
		cost:'half the cycle is a penalty'},
	seasons:    {short:'Selebrak',  gain:'seasonal effects boosted',
		cost:'switching season costs twice as much'},
	creation:   {short:'Dotjeiess', gain:'all buildings 7% cheaper',
		cost:'heavenly chips have 30% less effect'},
	labor:      {short:'Muridal',   gain:'clicking is 15% more powerful',
		cost:'buildings give 3% less'},
	industry:   {short:'Jeremy',    gain:'buildings give 10% more',
		cost:'golden cookies appear 10% less often'},
	mother:     {short:'Mokalsium', gain:'milk is 10% more powerful',
		cost:'golden cookies appear 15% less often'},
	scorn:      {short:'Skruuia',   gain:'wrinklers appear 150% faster and eat 15% more',
		cost:'every golden cookie becomes a wrath cookie'},
	order:      {short:'Rigidel',   gain:'sugar lumps ripen an hour sooner',
		cost:'nothing, it is simply narrow'}
};

/**
 * The presets. Each is an arrangement for one way of playing, strongest slot
 * first, with the reason it is shaped that way - including which spirits are
 * deliberately left out, because that is usually the real decision.
 */
var PRESETS = [
	{
		key: 'idle',
		name: 'Idle production',
		gods: ['asceticism', 'industry', 'mother'],
		why: 'The three biggest passive multipliers there are. Holobore unslots itself the ' +
			 'moment you click a golden cookie and takes your swaps with it, so this is for ' +
			 'leaving the game alone - not for playing while it runs.'
	},
	{
		key: 'combo',
		name: 'Click combo',
		gods: ['ruin', 'labor', 'decadence'],
		why: 'Godzamok turns a mass building sell into a click buff, Muridal makes each of ' +
			 'those clicks harder, and Vomitrax stretches the golden cookie you are comboing ' +
			 'with. Jeremy and Mokalsium are left out on purpose: both make golden cookies ' +
			 'rarer, which is the last thing a combo wants.'
	},
	{
		key: 'golden',
		name: 'Golden cookies',
		gods: ['decadence', 'ages', 'order'],
		why: 'For chasing golden cookies without comboing. Nothing here reduces how often ' +
			 'they appear, which rules out the two obvious CpS spirits. Cyclius is a coin ' +
			 'flip on any given hour but averages out; Rigidel is simply free.'
	},
	{
		key: 'wrinklers',
		name: 'Wrinkler farm',
		gods: ['scorn', 'industry', 'mother'],
		why: 'Skruuia makes wrinklers arrive far faster and eat more, and the two CpS ' +
			 'spirits feed them. Skruuia turns every golden cookie into a wrath cookie, so ' +
			 'do not sit clicking them while this is in.'
	},
	{
		key: 'buying',
		name: 'Building spree',
		gods: ['creation', 'industry', 'mother'],
		why: 'Dotjeiess makes everything 7% cheaper, which is worth most right before a big ' +
			 'buying run. Its penalty is on heavenly chips, so take it out again before you ' +
			 'ascend.'
	},
	{
		key: 'lumps',
		name: 'Sugar lumps',
		gods: ['order', 'industry', 'mother'],
		why: 'Rigidel ripens a lump an hour sooner with no drawback at all. The other two ' +
			 'slots may as well be earning.'
	}
];

/* ------------------------------------------------------------------ *
 * Settings and state
 * ------------------------------------------------------------------ */

var DEFAULTS = {
	confirmCost: 2      // ask first when an arrangement would cost this many swaps or more
};

var S = {};
(function () { for (var k in DEFAULTS) S[k] = DEFAULTS[k]; })();

// Player-defined arrangements. Each is {name, gods:[key|null, key|null, key|null]}.
var saved = [];

var statusText = 'waiting for the Temple';
var pending = null;          // an arrangement awaiting confirmation
var panelJustBuilt = false;
var uiBroken = false;
var showHelp = false;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function pantheon() {
	if (typeof Game === 'undefined' || !Game.Objects) return null;
	var temple = Game.Objects['Temple'];
	if (!temple || !temple.minigameLoaded || !temple.minigame) return null;
	var m = temple.minigame;
	return (m.gods && m.godsById && m.slot && m.slotGod) ? m : null;
}

/** The three slots as spirit keys, with null for an empty socket. */
function currentArrangement(m) {
	var out = [];
	for (var i = 0; i < 3; i++) {
		var id = m.slot[i];
		out.push((id === undefined || id === -1) ? null : m.godsById[id].key || keyOf(m, id));
	}
	return out;
}

/** The game gives each spirit an id but no key of its own. */
function keyOf(m, id) {
	for (var k in m.gods) if (m.gods[k].id === id) return k;
	return null;
}

function godName(m, key) {
	if (!key) return 'empty';
	return (GODS[key] && GODS[key].short) || (m.gods[key] ? m.gods[key].name : key);
}

function fmtTime(ms) {
	if (ms <= 0) return 'now';
	var mins = Math.round(ms / 60000);
	if (mins < 60) return mins + 'm';
	var h = Math.floor(mins / 60);
	return h + 'h ' + (mins % 60) + 'm';
}

/** Milliseconds until the next worship swap comes back, from the game's curve. */
function nextSwapIn(m) {
	if (m.swaps >= 3) return 0;
	var t = 1000 * 60 * 60;
	if (m.swaps === 0) t = 1000 * 60 * 60 * 16;
	else if (m.swaps === 1) t = 1000 * 60 * 60 * 4;
	return Math.max(0, m.swapT + t - Date.now());
}

/* ------------------------------------------------------------------ *
 * What an arrangement really costs
 * ------------------------------------------------------------------ */

/**
 * One drag, with the game's own consequences.
 *
 * M.slotGod does not simply put a spirit somewhere: if the target socket is
 * occupied, the two exchange places, and a spirit dragged in from the roster
 * pushes the previous occupant back out to it. Any cost calculation that
 * ignores that overcounts, and overcounting here means telling someone a move
 * costs three swaps - twenty-one hours - when it costs one.
 */
function applyMove(state, key, slot) {
	var next = state.slice();
	var from = -1;
	for (var i = 0; i < 3; i++) if (next[i] === key) from = i;
	var prev = next[slot];

	if (from >= 0) next[from] = prev;      // they exchange
	next[slot] = key;
	if (from < 0 && prev !== null) {
		// The displaced spirit goes back to the roster; nothing else moves.
	}
	return next;
}

/**
 * The minimum number of drags to get from one arrangement to another, found by
 * searching rather than reasoned about - there are only three sockets, so the
 * whole space is a handful of states and an exact answer is cheaper than a
 * clever rule that might be wrong.
 *
 * Returns {cost, moves:[[key, slot], ...]} or null if it cannot be reached.
 */
function planMoves(from, to) {
	var startKey = from.join('|'), goalKey = to.join('|');
	if (startKey === goalKey) return {cost: 0, moves: []};

	// Only the spirits involved can matter.
	var pool = [];
	from.concat(to).forEach(function (k) {
		if (k && pool.indexOf(k) < 0) pool.push(k);
	});

	var seen = {};
	seen[startKey] = true;
	var queue = [{state: from, moves: []}];

	while (queue.length) {
		var node = queue.shift();
		if (node.moves.length >= 4) continue;      // three sockets can never need more
		for (var p = 0; p < pool.length; p++) {
			for (var s = 0; s < 3; s++) {
				if (node.state[s] === pool[p]) continue;
				var next = applyMove(node.state, pool[p], s);
				var k = next.join('|');
				if (seen[k]) continue;
				var moves = node.moves.concat([[pool[p], s]]);
				if (k === goalKey) return {cost: moves.length, moves: moves};
				seen[k] = true;
				queue.push({state: next, moves: moves});
			}
		}
	}
	return null;
}

function costOf(m, target) {
	var plan = planMoves(currentArrangement(m), target);
	return plan ? plan.cost : null;
}

/* ------------------------------------------------------------------ *
 * Applying one
 * ------------------------------------------------------------------ */

/**
 * The game moves the spirit's own element into the socket when you drop it, so
 * changing M.slot alone would leave the Temple showing the old arrangement.
 * This mirrors exactly what dropGod does to the DOM.
 */
function placeDOM(m, god, slot) {
	if (typeof document === 'undefined') return;
	var div = document.getElementById('templeGod' + god.id);
	if (!div) return;
	if (slot === -1) {
		var ph = document.getElementById('templeGodPlaceholder' + god.id);
		if (ph && ph.parentNode) ph.parentNode.insertBefore(div, ph);
	} else {
		var sock = document.getElementById('templeSlot' + slot);
		if (sock) sock.appendChild(div);
	}
}

function applyArrangement(m, target) {
	var plan = planMoves(currentArrangement(m), target);
	if (!plan) { statusText = 'that arrangement cannot be reached'; return false; }
	if (plan.cost === 0) { statusText = 'already set up that way'; return true; }
	if (plan.cost > m.swaps) {
		statusText = 'needs ' + plan.cost + ' swaps, you have ' + m.swaps;
		return false;
	}

	for (var i = 0; i < plan.moves.length; i++) {
		var key = plan.moves[i][0], slot = plan.moves[i][1];
		var god = m.gods[key];
		if (!god) continue;
		var displaced = (m.slot[slot] !== -1) ? m.godsById[m.slot[slot]] : null;
		var fromSlot = god.slot;

		m.slotGod(god, slot);
		m.useSwap(1);
		m.lastSwapT = 0;

		placeDOM(m, god, slot);
		if (displaced && displaced !== god) placeDOM(m, displaced, fromSlot);
	}

	if (typeof Game !== 'undefined') Game.recalculateGains = 1;
	statusText = 'applied for ' + plan.cost + ' swap' + (plan.cost === 1 ? '' : 's') +
		'; ' + m.swaps + ' left';
	return true;
}

/**
 * Applying is the one thing here that cannot be undone for hours, so anything
 * that costs real time asks first. One swap is an hour and is waved through;
 * two is five hours and three is twenty-one.
 */
function request(m, target, label) {
	var plan = planMoves(currentArrangement(m), target);
	if (!plan) { statusText = 'that arrangement cannot be reached'; return; }
	if (plan.cost === 0) { statusText = 'already set up that way'; return; }
	if (plan.cost > m.swaps) {
		statusText = label + ' needs ' + plan.cost + ' swaps and you have ' + m.swaps +
			' - next one in ' + fmtTime(nextSwapIn(m));
		return;
	}
	if (plan.cost >= S.confirmCost) {
		pending = {target: target, label: label, cost: plan.cost};
		return;
	}
	applyArrangement(m, target);
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

var HELP = {
	swaps:  'Worship swaps are what rearranging costs. They come back slowly and unevenly: ' +
	        'the third after an hour, the second after four, the first after sixteen. Going ' +
	        'from three to none and back is twenty-one hours, which is why every button here ' +
	        'tells you its price first.',
	cost:   'The true minimum number of drags, not the number of sockets that differ. Dropping ' +
	        'a spirit onto an occupied socket makes the two exchange places, so two spirits ' +
	        'trading sockets costs one swap rather than two.',
	save:   'Store the arrangement currently in the Temple under a name, so you can come back ' +
	        'to it later. Saving costs nothing - only applying one does.',
	preset: 'Hover a preset for what it does and, more usefully, what it costs you. Every ' +
	        'spirit in this game gives with one hand and takes with the other.'
};

function tip(key) {
	return HELP[key] ? ' title="' + HELP[key].replace(/"/g, '&quot;') + '"' : '';
}

function buildCSS() {
return [
	'#' + PANEL_ID + '{position:relative;z-index:120;margin:0;padding:8px 24px 10px 24px;',
	'background:rgba(0,0,0,0.84);color:#e8e8e8;font-size:14px;text-align:left;',
	'border-top:1px solid #c8a24a;box-shadow:0 0 8px rgba(0,0,0,0.6) inset;}',
	'#' + PANEL_ID + ' .ppRow{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:4px 0;}',
	'#' + PANEL_ID + ' .ppTitle{font-weight:bold;color:#e2c274;letter-spacing:1px;}',
	'#' + PANEL_ID + ' .ppBtn{cursor:pointer;border:1px solid rgba(255,255,255,0.35);border-radius:3px;',
	'padding:1px 9px;font-weight:bold;font-size:13px;background:rgba(255,255,255,0.08);color:#fff;}',
	'#' + PANEL_ID + ' .ppBtn:hover{background:rgba(255,255,255,0.2);}',
	'#' + PANEL_ID + ' .ppBtn.ppOn{background:#c8a24a;color:#20180a;border-color:#f0dcae;}',
	'#' + PANEL_ID + ' .ppBtn.ppDim{opacity:0.45;}',
	'#' + PANEL_ID + ' .ppStat{font-size:13px;color:#bbb;}',
	'#' + PANEL_ID + ' .ppStat b{color:#fff;}',
	'#' + PANEL_ID + ' .ppSep{border:0;height:1px;background:#4a3f28;margin:6px 0;}',
	'#' + PANEL_ID + ' .ppNote{font-size:12px;color:#9a9a9a;max-width:680px;line-height:1.45;}',
	'#' + PANEL_ID + ' .ppSlot{display:inline-block;min-width:104px;padding:2px 7px;border-radius:3px;',
	'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);font-size:13px;}',
	'#' + PANEL_ID + ' .ppGem1{border-color:#8fd4ee;} #' + PANEL_ID + ' .ppGem2{border-color:#ee8f8f;}',
	'#' + PANEL_ID + ' .ppGem3{border-color:#9fe08f;}',
	'#' + PANEL_ID + ' .ppCost{color:#e2c274;font-weight:bold;}',
	'#' + PANEL_ID + ' .ppWarn{background:rgba(210,140,40,0.16);border:1px solid #c8912e;',
	'border-radius:4px;padding:5px 9px;margin:5px 0;}',
	'#' + PANEL_ID + ' .ppWarnText{color:#ffd75e;font-size:13px;}',
	'#' + PANEL_ID + ' [title]{cursor:help;}',
	'#' + PANEL_ID + ' .ppBtn[title]{cursor:pointer;}'
].join('');
}

function injectCSS() {
	if (document.getElementById('papasPantheonCSS')) return;
	var st = document.createElement('style');
	st.id = 'papasPantheonCSS';
	st.textContent = buildCSS();
	document.head.appendChild(st);
}

function presetTip(m, p) {
	var parts = [];
	for (var i = 0; i < 3; i++) {
		var g = GODS[p.gods[i]];
		parts.push(SLOT_NAMES[i] + ': ' + godName(m, p.gods[i]) +
			(g ? ' - ' + g.gain + ' (' + g.cost + ')' : ''));
	}
	return (p.why + '\n\n' + parts.join('\n')).replace(/"/g, '&quot;');
}

function buildPanel(host, m) {
	injectCSS();
	var panel = document.createElement('div');
	panel.id = PANEL_ID;

	var presetBtns = '';
	for (var i = 0; i < PRESETS.length; i++) {
		presetBtns += '<div class="ppBtn" data-act="preset" data-preset="' + PRESETS[i].key +
			'" id="ppPreset-' + PRESETS[i].key + '" title="' + presetTip(m, PRESETS[i]) + '">' +
			PRESETS[i].name + '</div>';
	}

	panel.innerHTML =
		'<div class="ppRow">' +
			'<span class="ppTitle">PAPA&#39;S PANTHEON</span>' +
			'<span class="ppStat" id="ppSwaps"' + tip('swaps') + '></span>' +
			'<div class="ppBtn" data-act="help">How swaps work</div>' +
		'</div>' +
		'<div class="ppRow" id="ppNow"></div>' +
		'<div id="ppHelpBox" style="display:none;"><hr class="ppSep">' +
			'<span class="ppNote">' + HELP.swaps + ' ' + HELP.cost + '</span></div>' +
		'<div id="ppWarnRow" class="ppRow ppWarn" style="display:none;">' +
			'<span class="ppWarnText" id="ppWarnText"></span>' +
			'<div class="ppBtn" data-act="confirm">Spend them</div>' +
			'<div class="ppBtn" data-act="cancel">Leave it</div>' +
		'</div>' +
		'<hr class="ppSep">' +
		'<div class="ppRow"><span class="ppStat"' + tip('preset') + '>Presets</span>' +
			presetBtns + '</div>' +
		'<div class="ppRow"><span class="ppNote" id="ppPresetNote"></span></div>' +
		'<hr class="ppSep">' +
		'<div class="ppRow"><span class="ppStat"' + tip('save') + '>Your slots</span>' +
			'<span id="ppSaved"></span>' +
			'<div class="ppBtn" data-act="store">Save what is in the Temple</div>' +
		'</div>' +
		'<div class="ppRow"><span class="ppStat" id="ppStatus"></span></div>';

	host.parentNode.insertBefore(panel, host.nextSibling);
	panel.addEventListener('click', onPanelClick);
	return panel;
}

function ensurePanel(m) {
	if (typeof document === 'undefined') return null;
	var panel = document.getElementById(PANEL_ID);
	if (panel && panel.isConnected) return panel;
	var host = document.getElementById('templeContent');
	if (!host) return null;
	if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
	panelJustBuilt = true;
	return buildPanel(host, m);
}

function presetByKey(key) {
	for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return PRESETS[i];
	return null;
}

function onPanelClick(e) {
	var el = e.target.closest ? e.target.closest('[data-act]') : null;
	if (!el) return;
	var m = pantheon();
	if (!m) return;
	var act = el.getAttribute('data-act');

	if (act === 'help') {
		showHelp = !showHelp;
	} else if (act === 'preset') {
		var p = presetByKey(el.getAttribute('data-preset'));
		if (p) request(m, p.gods.slice(), p.name);
	} else if (act === 'load') {
		var idx = parseInt(el.getAttribute('data-slot'), 10);
		if (saved[idx]) request(m, saved[idx].gods.slice(), saved[idx].name);
	} else if (act === 'forget') {
		var i2 = parseInt(el.getAttribute('data-slot'), 10);
		if (saved[i2]) { statusText = 'forgot "' + saved[i2].name + '"'; saved.splice(i2, 1); }
		rebuildPanel();
	} else if (act === 'store') {
		storeCurrent(m);
		rebuildPanel();
	} else if (act === 'confirm') {
		if (pending) { applyArrangement(m, pending.target); pending = null; }
	} else if (act === 'cancel') {
		if (pending) { statusText = 'left "' + pending.label + '" alone'; pending = null; }
	}
	safeUI('panel refresh', refreshPanel);
}

/** Saving costs nothing, so it never asks - it just records what is in there. */
function storeCurrent(m) {
	var now = currentArrangement(m);
	if (!now[0] && !now[1] && !now[2]) { statusText = 'nothing is slotted to save'; return; }
	var parts = [];
	for (var i = 0; i < 3; i++) if (now[i]) parts.push(godName(m, now[i]));
	var name = parts.join(' / ');
	for (var j = 0; j < saved.length; j++) {
		if (saved[j].gods.join('|') === now.join('|')) {
			statusText = 'that arrangement is already saved as "' + saved[j].name + '"';
			return;
		}
	}
	saved.push({name: name, gods: now});
	statusText = 'saved "' + name + '"';
}

function setText(id, text) {
	var el = document.getElementById(id);
	if (el && el.textContent !== text) el.textContent = text;
}

function setHTML(id, html) {
	var el = document.getElementById(id);
	if (el && el.innerHTML !== html) el.innerHTML = html;
}

/** The saved list changes shape rather than content, so it is rebuilt whole. */
function rebuildPanel() {
	var panel = document.getElementById(PANEL_ID);
	if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
	var m = pantheon();
	if (m) { ensurePanel(m); }
}

function refreshPanel() {
	var m = pantheon();
	if (!m || !document.getElementById(PANEL_ID)) return;

	setText('ppSwaps', 'Worship swaps ' + m.swaps + '/3' +
		(m.swaps < 3 ? '  -  next in ' + fmtTime(nextSwapIn(m)) : ''));

	var now = currentArrangement(m), html = '<span class="ppStat">Now</span>';
	for (var i = 0; i < 3; i++) {
		var g = GODS[now[i]];
		html += '<span class="ppSlot ppGem' + (i + 1) + '" title="' + SLOT_NAMES[i] + ' slot' +
			(g ? ': ' + (g.gain + ' (' + g.cost + ')').replace(/"/g, '&quot;') : '') + '">' +
			godName(m, now[i]) + '</span>';
	}
	setHTML('ppNow', html);

	var helpBox = document.getElementById('ppHelpBox');
	if (helpBox) helpBox.style.display = showHelp ? 'block' : 'none';

	// Presets: dimmed when they cost more than you have, and always priced.
	var noteParts = [];
	for (var p = 0; p < PRESETS.length; p++) {
		var cost = costOf(m, PRESETS[p].gods);
		var btn = document.getElementById('ppPreset-' + PRESETS[p].key);
		if (!btn) continue;
		var cls = 'ppBtn' + (cost === 0 ? ' ppOn' : (cost > m.swaps ? ' ppDim' : ''));
		if (btn.className !== cls) btn.className = cls;
		noteParts.push(PRESETS[p].name + ': ' +
			(cost === 0 ? 'in place' : cost + ' swap' + (cost === 1 ? '' : 's')));
	}
	setText('ppPresetNote', noteParts.join('   -   '));

	// Saved arrangements.
	var sh = '';
	if (!saved.length) {
		sh = '<span class="ppNote">none yet</span>';
	} else {
		for (var s = 0; s < saved.length; s++) {
			var c = costOf(m, saved[s].gods);
			sh += '<div class="ppBtn' + (c === 0 ? ' ppOn' : (c > m.swaps ? ' ppDim' : '')) +
				'" data-act="load" data-slot="' + s + '" title="' +
				saved[s].gods.map(function (k, i2) { return SLOT_NAMES[i2] + ': ' + godName(m, k); })
					.join(', ').replace(/"/g, '&quot;') +
				'">' + saved[s].name + ' <span class="ppCost">' +
				(c === 0 ? 'in place' : c + 'sw') + '</span></div>' +
				'<div class="ppBtn" data-act="forget" data-slot="' + s +
				'" title="Forget this one">x</div>';
		}
	}
	setHTML('ppSaved', sh);

	var warn = document.getElementById('ppWarnRow');
	if (warn) {
		if (pending) {
			warn.style.display = 'flex';
			setText('ppWarnText', '"' + pending.label + '" costs ' + pending.cost +
				' worship swaps, and they come back over ' +
				(pending.cost >= 3 ? '21 hours' : pending.cost === 2 ? '5 hours' : 'an hour') +
				'. Go ahead?');
		} else {
			warn.style.display = 'none';
		}
	}

	setText('ppStatus', statusText);
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

function saveString() {
	return JSON.stringify({v: 1, S: S, saved: saved});
}

function loadString(str) {
	if (!str) return;
	var data = JSON.parse(str);
	if (data.S) for (var k in DEFAULTS) {
		if (typeof data.S[k] === typeof DEFAULTS[k]) S[k] = data.S[k];
	}
	saved = [];
	if (data.saved && data.saved.length) {
		for (var i = 0; i < data.saved.length; i++) {
			var e = data.saved[i];
			if (!e || !e.gods || e.gods.length !== 3) continue;
			// Drop anything naming a spirit this game does not have, rather than
			// keeping a slot that would silently do the wrong thing.
			var ok = true;
			for (var j = 0; j < 3; j++) {
				if (e.gods[j] !== null && !GODS[e.gods[j]]) ok = false;
			}
			if (ok) saved.push({name: String(e.name || 'saved'), gods: e.gods.slice()});
		}
	}
}

/* ------------------------------------------------------------------ *
 * Hooks
 * ------------------------------------------------------------------ */

function safeUI(what, fn) {
	if (uiBroken) return;
	try {
		fn();
	} catch (err) {
		uiBroken = true;
		console.error('[Papa\'s Pantheon] ' + what + ' failed - the panel is disabled for ' +
			'this session. Please report this:', err);
	}
}

function onLogic() {
	var m = pantheon();
	if (!m) return;
	safeUI('panel setup', function () {
		ensurePanel(m);
		if (panelJustBuilt) { panelJustBuilt = false; refreshPanel(); }
	});
	safeUI('panel refresh', refreshPanel);
}

function onReset() {
	// Ascending empties the pantheon, so a pending question refers to an
	// arrangement that no longer exists.
	pending = null;
	statusText = 'reset - the Temple is empty again';
}

Game.registerMod(MOD_ID, {
	init: function () {
		Game.registerHook('logic', onLogic);
		Game.registerHook('reset', onReset);
		console.log('[Papa\'s Pantheon] v' + VERSION + ' ready.');
	},
	save: function () {
		try { return saveString(); } catch (e) { return ''; }
	},
	load: function (str) {
		try { loadString(str); } catch (e) { /* keep defaults */ }
	},

	/** Read-only window for other mods and for moddev/test.js. */
	version: VERSION,
	getPresets:     function () { return PRESETS; },
	getSaved:       function () { return saved; },
	getArrangement: function () { var m = pantheon(); return m ? currentArrangement(m) : null; },
	getCost:        function (target) { var m = pantheon(); return m ? costOf(m, target) : null; },
	planMoves:      function (from, to) { return planMoves(from, to); },
	apply:          function (target) { var m = pantheon(); return m ? applyArrangement(m, target) : false; },
	request:        function (target, label) { var m = pantheon(); if (m) request(m, target, label || 'arrangement'); },
	getPending:     function () { return pending; },
	store:          function () { var m = pantheon(); if (m) storeCurrent(m); },
	getStatus:      function () { return statusText; },
	getSettings:    function () { return S; }
});

})();
