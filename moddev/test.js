/**
 * Behavioural tests for Papa's Pantheon, run against the game's real
 * minigamePantheon.js through pantheon.js.
 *
 *   node test.js
 *
 * The cost calculation is the whole point of the mod - telling someone a move
 * costs three swaps when it costs one is telling them twenty-one hours when it
 * is one - so it is not checked against a description of slotGod. Every plan is
 * actually executed through the game's own slotGod and the result compared.
 */
'use strict';

var boot = require('./pantheon.js').boot;

var passed = 0, failed = 0;

function ok(name, cond, detail) {
	if (cond) { passed++; console.log('  ok   ' + name); }
	else { failed++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
}

function eq(name, got, want) {
	ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
}

function fresh(opts) {
	var sb = boot(opts);
	sb.mod = sb.loadMod();
	return sb;
}

var ALL = ['asceticism', 'decadence', 'ruin', 'ages', 'seasons', 'creation',
           'labor', 'industry', 'mother', 'scorn', 'order'];

/* ------------------------------------------------------------------ *
 * 1. What a rearrangement costs
 * ------------------------------------------------------------------ */
console.log('\nthe cost of a rearrangement');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);

	eq('nothing to do costs nothing',
		sb.mod.getCost(['asceticism', 'industry', 'mother']), 0);
	eq('changing one socket costs one',
		sb.mod.getCost(['asceticism', 'industry', 'order']), 1);

	// The one that a naive "count the differing sockets" rule gets wrong:
	// dropping a spirit on an occupied socket makes the two exchange places.
	eq('two spirits trading sockets costs one, not two',
		sb.mod.getCost(['industry', 'asceticism', 'mother']), 1);
	eq('a three-way rotation costs two, not three',
		sb.mod.getCost(['mother', 'asceticism', 'industry']), 2);
	eq('replacing all three costs three',
		sb.mod.getCost(['ruin', 'labor', 'decadence']), 3);

	sb.setArrangement([null, null, null]);
	eq('filling an empty pantheon costs three',
		sb.mod.getCost(['ruin', 'labor', 'decadence']), 3);
	eq('filling one socket of an empty pantheon costs one',
		sb.mod.getCost([null, 'labor', null]), 1);
})();

(function () {
	// The claim is checked against the game rather than against itself: run the
	// plan through the real slotGod and see where the spirits end up.
	var checked = 0, wrongResult = 0, wrongCost = 0, notMinimal = 0;

	function brute(from, to) {
		// Independent shortest-path search, written differently on purpose, so
		// a shared mistake in the mod's own search would show up here. Layered:
		// take every free unslot first (the game charges nothing for dragging a
		// spirit back to the roster), then spend one drag, and repeat.
		var goal = to.join('|');
		var pool = [];
		from.concat(to).forEach(function (k) { if (k && pool.indexOf(k) < 0) pool.push(k); });

		function unslotClosure(states) {
			var out = {}, stack = [];
			for (var k in states) { out[k] = states[k]; stack.push(states[k]); }
			while (stack.length) {
				var s = stack.pop();
				for (var i = 0; i < 3; i++) {
					if (s[i] === null) continue;
					var n = s.slice(); n[i] = null;
					var nk = n.join('|');
					if (!out[nk]) { out[nk] = n; stack.push(n); }
				}
			}
			return out;
		}

		var layer = {};
		layer[from.join('|')] = from;
		for (var paid = 0; paid <= 3; paid++) {
			layer = unslotClosure(layer);
			if (layer[goal]) return paid;
			var nextLayer = {};
			for (var key in layer) {
				var s = layer[key];
				for (var p = 0; p < pool.length; p++) {
					for (var sl = 0; sl < 3; sl++) {
						if (s[sl] === pool[p]) continue;
						var next = s.slice();
						var at = next.indexOf(pool[p]);
						var prev = next[sl];
						if (at >= 0) next[at] = prev;
						next[sl] = pool[p];
						nextLayer[next.join('|')] = next;
					}
				}
			}
			layer = nextLayer;
		}
		return null;
	}

	function rnd(seed) {
		var x = Math.sin(seed) * 10000;
		return x - Math.floor(x);
	}

	// One sandbox for the whole sweep: booting one evaluates the game's source,
	// which is far more expensive than the thing being measured.
	var sb = fresh();
	for (var trial = 0; trial < 300; trial++) {
		var pick = function (t) {
			var a = [];
			// The attempt counter has to be part of the seed: without it a
			// repeated draw reproduces itself forever, because nothing else
			// about the seed changes when the pick is rejected.
			for (var attempt = 0; a.length < 3 && attempt < 200; attempt++) {
				var g = ALL[Math.floor(rnd(trial * 97 + t * 13 + attempt * 7) * ALL.length)];
				if (a.indexOf(g) < 0) a.push(g);
			}
			while (a.length < 3) a.push(ALL[a.length]);
			// Sometimes leave a socket empty.
			if (rnd(trial * 31 + t) < 0.2) a[Math.floor(rnd(trial + t) * 3)] = null;
			return a;
		};
		var from = pick(1), to = pick(2);
		sb.setArrangement(from);
		sb.M.swaps = 3;

		var predicted = sb.mod.getCost(to);
		var minimal = brute(from, to);
		checked++;

		if (predicted !== minimal) { notMinimal++; continue; }
		if (predicted === null || predicted > 3) continue;

		var before = sb.M.swaps;
		sb.mod.apply(to);
		if (sb.arrangement().join('|') !== to.join('|')) wrongResult++;
		if (before - sb.M.swaps !== predicted) wrongCost++;
	}

	ok('checked ' + checked + ' random rearrangements', checked >= 250);
	eq('the predicted cost is always the true minimum', notMinimal, 0);
	eq('applying the plan always lands on the target', wrongResult, 0);
	eq('and spends exactly the predicted number of swaps', wrongCost, 0);
})();

/* ------------------------------------------------------------------ *
 * 1b. Dragging a spirit back to the roster is free
 * ------------------------------------------------------------------ */
console.log('\nfree moves back to the roster');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 3;

	eq('emptying one socket is free',
		sb.mod.getCost(['asceticism', 'industry', null]), 0);
	ok('and applying it works', sb.mod.apply(['asceticism', 'industry', null]));
	eq('the spirit went back to the roster',
		sb.arrangement().join('|'), 'asceticism|industry|');
	eq('and no swap was spent', sb.M.swaps, 3);
	ok('and the status says it was free',
		/without spending/.test(sb.mod.getStatus()), sb.mod.getStatus());

	eq('emptying the whole pantheon is free',
		sb.mod.getCost([null, null, null]), 0);

	// The audit example: ['a','b',null] to ['b',null,null] was reported
	// unreachable before free unslots were part of the search.
	sb.setArrangement(['asceticism', 'industry', null]);
	sb.M.swaps = 3;
	eq('keeping one spirit and dropping the other costs one',
		sb.mod.getCost(['industry', null, null]), 1);
	ok('and it applies', sb.mod.apply(['industry', null, null]));
	eq('landing exactly on the target', sb.arrangement().join('|'), 'industry||');
	eq('for exactly one swap', sb.M.swaps, 2);
})();

/* ------------------------------------------------------------------ *
 * 2. It cannot spend what you do not have
 * ------------------------------------------------------------------ */
console.log('\nspending swaps');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 1;

	var before = sb.arrangement().join('|');
	var done = sb.mod.apply(['ruin', 'labor', 'decadence']);   // costs 3
	eq('a rearrangement you cannot afford is refused', done, false);
	eq('and nothing moved', sb.arrangement().join('|'), before);
	eq('and no swap was spent', sb.M.swaps, 1);
	ok('and it says what it needed', /needs 3 swaps/.test(sb.mod.getStatus()), sb.mod.getStatus());

	// One swap is affordable.
	ok('an affordable one goes through', sb.mod.apply(['asceticism', 'industry', 'order']));
	eq('leaving no swaps', sb.M.swaps, 0);
})();

(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 3;
	sb.mod.apply(['asceticism', 'industry', 'mother']);
	eq('applying what is already in place spends nothing', sb.M.swaps, 3);
})();

/* ------------------------------------------------------------------ *
 * 3. Anything expensive asks first
 * ------------------------------------------------------------------ */
console.log('\nconfirmation');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 3;

	// One swap is an hour; it is waved through.
	sb.mod.request(['asceticism', 'industry', 'order'], 'one socket');
	eq('a one-swap change happens straight away', sb.M.swaps, 2);
	eq('with nothing left pending', sb.mod.getPending(), null);

	// Two is five hours, three is twenty-one - those ask.
	sb.M.swaps = 3;
	sb.mod.request(['ruin', 'labor', 'decadence'], 'Click combo');
	var p = sb.mod.getPending();
	ok('an expensive one waits for an answer', !!p && p.cost === 3, JSON.stringify(p));
	eq('and has not spent anything yet', sb.M.swaps, 3);
	ok('the question names the arrangement', p.label === 'Click combo');
})();

(function () {
	// Asking for something unaffordable does not queue a question, it explains.
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 1;
	sb.mod.request(['ruin', 'labor', 'decadence'], 'Click combo');
	eq('nothing is queued', sb.mod.getPending(), null);
	ok('and the reason mentions the wait',
		/next one in/.test(sb.mod.getStatus()), sb.mod.getStatus());
})();

/* ------------------------------------------------------------------ *
 * 4. The presets
 * ------------------------------------------------------------------ */
console.log('\npresets');
(function () {
	var sb = fresh();
	var presets = sb.mod.getPresets();
	ok('there are presets (' + presets.length + ')', presets.length >= 5);

	var seen = {};
	presets.forEach(function (p) {
		ok(p.name + ' names three spirits', p.gods.length === 3);
		p.gods.forEach(function (g) {
			ok(p.name + ': "' + g + '" is a real spirit', ALL.indexOf(g) >= 0);
		});
		var uniq = {};
		p.gods.forEach(function (g) { uniq[g] = 1; });
		eq(p.name + ' does not slot the same spirit twice', Object.keys(uniq).length, 3);
		ok(p.name + ' explains itself', typeof p.why === 'string' && p.why.length > 40);
		eq(p.name + ' has a unique key', seen[p.key], undefined);
		seen[p.key] = 1;
	});

	// A preset must be reachable from an empty pantheon for three swaps.
	sb.setArrangement([null, null, null]);
	presets.forEach(function (p) {
		eq(p.name + ' costs three from empty', sb.mod.getCost(p.gods), 3);
	});
})();

(function () {
	// The two spirits that make golden cookies rarer must not be in the presets
	// that are about golden cookies - that would be self-defeating.
	var sb = fresh();
	sb.mod.getPresets().forEach(function (p) {
		if (p.key === 'combo' || p.key === 'golden') {
			ok(p.name + ' avoids spirits that make golden cookies rarer',
				p.gods.indexOf('industry') < 0 && p.gods.indexOf('mother') < 0,
				p.gods.join(','));
		}
	});
})();

/* ------------------------------------------------------------------ *
 * 5. Save slots
 * ------------------------------------------------------------------ */
console.log('\nsave slots');
(function () {
	var sb = fresh();
	sb.setArrangement(['ruin', 'labor', 'decadence']);
	sb.mod.store();
	var saved = sb.mod.getSaved();
	eq('storing the current arrangement adds a slot', saved.length, 1);
	eq('and records it exactly', saved[0].gods.join('|'), 'ruin|labor|decadence');
	ok('with a readable name', /Godzamok/.test(saved[0].name), saved[0].name);

	sb.mod.store();
	eq('storing the same thing twice does not duplicate it', sb.mod.getSaved().length, 1);
	ok('and it says why', /already saved/.test(sb.mod.getStatus()), sb.mod.getStatus());

	sb.setArrangement(['order', 'industry', 'mother']);
	sb.mod.store();
	eq('a different arrangement is a new slot', sb.mod.getSaved().length, 2);

	// Saving must never cost a swap.
	sb.M.swaps = 2;
	sb.mod.store();
	eq('saving never spends a swap', sb.M.swaps, 2);
})();

(function () {
	var sb = fresh();
	sb.setArrangement([null, null, null]);
	sb.mod.store();
	eq('an empty pantheon is not worth saving', sb.mod.getSaved().length, 0);
	ok('and it says so', /nothing is slotted/.test(sb.mod.getStatus()), sb.mod.getStatus());
})();

(function () {
	// A saved slot must actually restore.
	var sb = fresh();
	sb.setArrangement(['ruin', 'labor', 'decadence']);
	sb.mod.store();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 3;

	var target = sb.mod.getSaved()[0].gods;
	ok('restoring a saved arrangement works', sb.mod.apply(target));
	eq('and puts the spirits back exactly',
		sb.arrangement().join('|'), 'ruin|labor|decadence');
})();

/* ------------------------------------------------------------------ *
 * 6. Persistence
 * ------------------------------------------------------------------ */
console.log('\npersistence');
(function () {
	var sb = fresh();
	sb.setArrangement(['ruin', 'labor', 'decadence']);
	sb.mod.store();
	var str = sb.mod.save();
	ok('save produced a string', typeof str === 'string' && str.length > 0);

	var sb2 = fresh();
	sb2.mod.load(str);
	eq('the saved slot survived', sb2.mod.getSaved().length, 1);
	eq('with its spirits intact',
		sb2.mod.getSaved()[0].gods.join('|'), 'ruin|labor|decadence');

	var sb3 = fresh();
	var threw = false;
	try { sb3.mod.load('not json'); } catch (e) { threw = true; }
	ok('a corrupt save does not throw', !threw);
	eq('and leaves no slots behind', sb3.mod.getSaved().length, 0);

	// A slot naming a spirit this game does not have is dropped rather than
	// kept as something that would quietly do the wrong thing.
	var sb4 = fresh();
	sb4.mod.load(JSON.stringify({v: 1, saved: [
		{name: 'bogus', gods: ['nosuchspirit', 'labor', 'ruin']},
		{name: 'fine', gods: ['order', 'industry', 'mother']}
	]}));
	eq('a slot naming an unknown spirit is dropped', sb4.mod.getSaved().length, 1);
	eq('and the good one is kept', sb4.mod.getSaved()[0].name, 'fine');
})();

/* ------------------------------------------------------------------ *
 * 7. The panel
 * ------------------------------------------------------------------ */
console.log('\nthe panel');
(function () {
	var errors = [];
	var realError = console.error;
	console.error = function () { errors.push(Array.prototype.join.call(arguments, ' ')); };
	var sb, panel;
	try {
		sb = fresh();
		sb.setArrangement(['asceticism', 'industry', 'mother']);
		sb.frame();
		panel = sb.dom.findCreated('papasPantheonPanel');
	} finally {
		console.error = realError;
	}

	ok('the panel is built', !!panel);
	eq('nothing was logged as an error', errors.join(' | '), '');

	var html = panel.innerHTML;
	ok('every preset has a button',
		(html.match(/data-act="preset"/g) || []).length === sb.mod.getPresets().length);
	ok('presets explain themselves on hover',
		(html.match(/data-act="preset"[^>]*title="/g) || []).length === sb.mod.getPresets().length);
	ok('there is a save button', html.indexOf('data-act="store"') >= 0);

	ok('the swap count is shown',
		/Worship swaps \d\/3/.test(sb.dom.get('ppSwaps').textContent),
		sb.dom.get('ppSwaps').textContent);
	ok('the current arrangement is shown',
		/Holobore/.test(sb.dom.get('ppNow').innerHTML), sb.dom.get('ppNow').innerHTML);
	ok('every preset is priced',
		/swap/.test(sb.dom.get('ppPresetNote').textContent),
		sb.dom.get('ppPresetNote').textContent);
})();

(function () {
	// The confirmation banner has to reach the panel.
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.M.swaps = 3;
	sb.frame();
	sb.mod.request(['ruin', 'labor', 'decadence'], 'Click combo');
	sb.frame();
	var text = sb.dom.get('ppWarnText').textContent;
	ok('it asks in words, with the real wait',
		/Click combo/.test(text) && /21 hours/.test(text), text);
})();

/* ------------------------------------------------------------------ *
 * 8. Hostile saved names stay text
 * ------------------------------------------------------------------ */
console.log('\nhostile names');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.mod.load(JSON.stringify({v: 1, saved: [
		{name: '<img src=x onerror=alert(1)>', gods: ['order', 'industry', 'mother']}
	]}));
	sb.frame();
	var html = sb.dom.get('ppSaved').innerHTML;
	ok('a hostile saved name is escaped, not markup',
		html.indexOf('<img') < 0 && html.indexOf('&lt;img') >= 0, html);
})();

/* ------------------------------------------------------------------ *
 * 9. The panel names its version
 * ------------------------------------------------------------------ */
console.log('\nversion');
(function () {
	var sb = fresh();
	sb.setArrangement(['asceticism', 'industry', 'mother']);
	sb.frame();
	var panel = sb.dom.findCreated('papasPantheonPanel');
	ok('the panel title shows the version',
		!!panel && panel.innerHTML.indexOf('ppVer">v' + sb.mod.version + '<') >= 0);
})();

/* ------------------------------------------------------------------ */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
