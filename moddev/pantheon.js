/**
 * Loads the game's real minigamePantheon.js into a sandbox.
 *
 * Nothing about the Temple is reimplemented: this is the shipped file, run
 * against stubs for the DOM and the Game globals it touches. So slotGod's
 * exchange behaviour - the thing the cost calculation depends on - is the
 * game's own, not a description of it.
 *
 *   var sb = require('./pantheon.js').boot();
 *   sb.M.slotGod(sb.M.gods['industry'], 0);
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

/*
 * The harness has to work from two places: inside the game tree (reached
 * through a junction as moddev/<Mod>) and inside the git repo (beside the mod
 * as Code/moddev). Each path is looked up among the candidates.
 */
function firstExisting(candidates, what) {
	for (var i = 0; i < candidates.length; i++) {
		if (fs.existsSync(candidates[i])) return candidates[i];
	}
	throw new Error('cannot find ' + what + ' - looked in:\n  ' + candidates.join('\n  '));
}

var GAME_DIR = 'C:/Program Files (x86)/Steam/steamapps/common/Cookie Clicker/resources/app';

function gameSrc(file) {
	return firstExisting([
		path.join(__dirname, '..', '..', 'src', file),
		path.join(GAME_DIR, 'src', file)
	], 'the game source ' + file);
}

function modMain(name) {
	return firstExisting([
		path.join(__dirname, '..', 'mod', 'main.js'),
		path.join(__dirname, '..', '..', 'mods', 'local', name, 'main.js'),
		path.join(GAME_DIR, 'mods', 'local', name, 'main.js')
	], name + '/main.js');
}

function makeDOM() {
	var byId = {}, created = [], root = null;
	function el(id) {
		var e = {
			id: id || '', innerHTML: '', textContent: '', value: '', className: '',
			style: {}, children: [], isConnected: true, parentNode: null,
			classList: {add: function () {}, remove: function () {}, contains: function () { return false; }},
			_on: {},
			appendChild: function (c) { return adopt(this, c, null); },
			insertBefore: function (c, ref) { return adopt(this, c, ref); },
			removeChild: function (c) {
				var i = this.children.indexOf(c);
				if (i >= 0) this.children.splice(i, 1);
				c.parentNode = null; c.isConnected = false; return c;
			},
			addEventListener: function (ev, fn) { (this._on[ev] || (this._on[ev] = [])).push(fn); },
			removeEventListener: function () {},
			click: function () { (this._on['click'] || []).forEach(function (f) { f({}); }); },
			setAttribute: function (k, v) { this[k] = v; },
			getAttribute: function (k) { return typeof this[k] === 'string' ? this[k] : null; },
			closest: function () { return null; },
			getBounds: function () { return {left: 0, right: 0, top: 0, bottom: 0}; },
			getBoundingClientRect: function () { return {left: 0, top: 0, width: 0, height: 0}; }
		};
		return e;
	}
	function adopt(parent, child, ref) {
		if (child.parentNode) {
			var was = child.parentNode.children.indexOf(child);
			if (was >= 0) child.parentNode.children.splice(was, 1);
		}
		var at = ref ? parent.children.indexOf(ref) : -1;
		if (at >= 0) parent.children.splice(at, 0, child);
		else parent.children.push(child);
		child.parentNode = parent;
		child.isConnected = true;
		if (child.id) byId[child.id] = child;
		return child;
	}
	root = el('root');
	function get(id) {
		if (!byId[id]) {
			var e = el(id);
			e.isConnected = false;
			e.parentNode = root;
			root.children.push(e);
			byId[id] = e;
		}
		return byId[id];
	}
	return {
		get: get, root: root, created: created,
		doc: {
			getElementById: get,
			createElement: function () { var e = el(''); created.push(e); return e; },
			head: el('head'), body: el('body'), addEventListener: function () {}
		},
		findCreated: function (id) {
			for (var i = created.length - 1; i >= 0; i--) if (created[i].id === id) return created[i];
			return null;
		}
	};
}

function boot(opts) {
	opts = opts || {};
	var dom = makeDOM();

	var Game = {
		Objects: {}, ObjectsById: [], mods: {}, hooks: {},
		cookies: 1e15, cookiesPs: 1e9, fps: 30, T: 0, drawT: 0,
		version: 2.053, resPath: '', mouseX: 0, mouseY: 0, keys: {},
		recalculateGains: 0, ascensionMode: 0,
		Has: function () { return false; },
		HasAchiev: function () { return false; },
		Win: function () {}, Unlock: function () {}, Notify: function () {}, Popup: function () {},
		SparkleAt: function () {}, SparkleOn: function () {},
		Spend: function (n) { Game.cookies -= n; },
		Earn: function (n) { Game.cookies += n; },
		auraMult: function () { return 0; },
		sayTime: function () { return 'a while'; },
		getDynamicTooltip: function () { return ''; },
		getTooltip: function () { return ''; },
		canRefillLump: function () { return true; },
		getLumpRefillMax: function () { return 0; },
		getLumpRefillRemaining: function () { return 0; },
		refillLump: function (n, cb) { if (cb) cb(); },
		registerMod: function (id, mod) { Game.mods[id] = mod; },
		registerHook: function (n, f) { (Game.hooks[n] || (Game.hooks[n] = [])).push(f); }
	};

	var buildings = {
		'Temple': {
			id: 6, name: 'Temple', single: 'Temple', plural: 'Temples',
			amount: opts.amount === undefined ? 200 : opts.amount,
			level: opts.level === undefined ? 5 : opts.level,
			minigameName: 'Pantheon', minigameLoaded: false, onMinigame: true
		}
	};
	Game.Objects = new Proxy(buildings, {
		get: function (t, k) {
			if (typeof k !== 'string') return t[k];
			if (!t[k]) t[k] = {id: 0, name: k, single: k, plural: k, amount: 0, level: 1};
			return t[k];
		},
		has: function () { return true; }
	});
	Game.ObjectsById[6] = Game.Objects['Temple'];

	var ctx = {
		Game: Game, Math: Math, document: dom.doc, window: {}, console: console,
		Date: Date, JSON: JSON, Array: Array, Object: Object, String: String,
		Number: Number, Boolean: Boolean, isFinite: isFinite,
		parseFloat: parseFloat, parseInt: parseInt,
		setTimeout: function () {}, clearTimeout: function () {},
		EN: 1, l: dom.get,
		loc: function (s) { return String(s); },
		cap: function (s) { return String(s); },
		FindLocStringByPart: function (s) { return String(s); },
		AddEvent: function () {}, PlaySound: function () {},
		Beautify: function (n) { return String(Math.round(n)); },
		LBeautify: function (n) { return String(Math.round(n)); },
		choose: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; }
	};
	ctx.globalThis = ctx;
	vm.createContext(ctx);

	var src = fs.readFileSync(gameSrc('minigamePantheon.js'), 'utf8').replace(/^\uFEFF/, '');
	vm.runInContext(src, ctx, {filename: 'minigamePantheon.js'});

	var M = Game.Objects['Temple'].minigame;
	M.launch();
	Game.Objects['Temple'].minigameLoaded = true;

	// The game gives each spirit an id but no key; the mod looks the key up, and
	// so do the tests.
	Object.keys(M.gods).forEach(function (k) { M.gods[k].key = k; });

	var out = {Game: Game, M: M, ctx: ctx, dom: dom};

	out.loadMod = function () {
		vm.runInContext(fs.readFileSync(modMain('PapasPantheon'), 'utf8'), ctx,
			{filename: 'PapasPantheon/main.js'});
		var mod = Game.mods['papas pantheon'];
		mod.init();
		return mod;
	};
	out.frame = function () {
		Game.T++;
		(Game.hooks['logic'] || []).forEach(function (f) { f(); });
	};
	/** Put an arrangement in place directly, without spending swaps. */
	out.setArrangement = function (keys) {
		for (var i = 0; i < 3; i++) {
			if (M.slot[i] !== -1) M.godsById[M.slot[i]].slot = -1;
			M.slot[i] = -1;
		}
		for (var j = 0; j < 3; j++) {
			if (!keys[j]) continue;
			M.slot[j] = M.gods[keys[j]].id;
			M.gods[keys[j]].slot = j;
		}
	};
	out.arrangement = function () {
		return [0, 1, 2].map(function (i) {
			return M.slot[i] === -1 ? null : M.godsById[M.slot[i]].key;
		});
	};
	return out;
}

module.exports = {boot: boot};
