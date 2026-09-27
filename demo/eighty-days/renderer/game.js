// The rules of Eighty Days: a state, and what each action does to it.
//
// Pure on purpose. Nothing here reads the clock, draws a random number, sets a
// timer or touches the page: every result follows from the state, the action
// and the data in data/. docs/DEMO_PLAN_EIGHTY_DAYS.md has why. The engine's
// replay rests on the game answering the same moves the same way, and
// demo/eighty-days/tests/determinism.spec.ts is the check that it does.
//
// Loaded as a plain script by the page, and by Node for tests, so it defines
// one global and exports it where there is a module system.
(function (root) {
  'use strict';

  const HOUR = 3600 * 1000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Kiouni's owner is offered these sums, in order, and yields at the last.
  // Chapter XII.
  const KIOUNI_OFFERS = [1000, 1200, 1500, 1800, 2000];
  const GUIDE_WAGE = 100;
  const BAIL = 2000;
  const HENRIETTA_PRICE = 12000;
  const COAL_PRICE = 600;
  // Hours the Detective's warrant holds Fogg at Liverpool, by how close he
  // has come. Two is the book's: from twenty minutes before twelve until the
  // special train at three.
  const WARRANT_HOURS = [0, 1, 3.33, 5, 8];

  /** Hours from the start to an ISO time, read as a plain calendar time with no zone. */
  function hoursAt(iso, startIso) {
    return (Date.parse(`${iso}:00Z`) - Date.parse(`${startIso}:00Z`)) / HOUR;
  }

  /** A calendar time some hours after the start, as parts. Pure arithmetic on UTC, so no zone enters. */
  function partsAt(hours, startIso) {
    const d = new Date(Date.parse(`${startIso}:00Z`) + Math.round(hours * 60) * 60 * 1000);
    return {
      weekday: WEEKDAYS[d.getUTCDay()],
      day: d.getUTCDate(),
      month: MONTHS[d.getUTCMonth()],
      year: d.getUTCFullYear(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }

  function clockText(hours, startIso) {
    const p = partsAt(hours, startIso);
    const h12 = ((p.hour + 11) % 12) + 1;
    const ampm = p.hour < 12 ? 'a.m.' : 'p.m.';
    return `${p.weekday}, ${p.day} ${p.month} ${p.year}, ${h12}.${String(p.minute).padStart(2, '0')} ${ampm}`;
  }

  function durationText(hours) {
    const minutes = Math.round(hours * 60);
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    const parts = [];
    if (d) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
    if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
    if (m) parts.push(`${m} minutes`);
    return parts.join(', ') || 'no time';
  }

  // Grouped by hand rather than by toLocaleString, whose output depends on the
  // machine's locale data.
  function pounds(n) {
    const digits = String(Math.round(n));
    return `£${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  /** Everything the rules need from data/, indexed once. */
  function prepare(data) {
    const start = data.story.wager.start;
    const places = Object.fromEntries(data.places.places.map((p) => [p.id, p]));
    const departures = data.departures.departures.map((d) => ({
      ...d,
      departsAt: d.departs ? hoursAt(d.departs, start) : undefined,
      arrivesAt: d.arrives ? hoursAt(d.arrives, start) : undefined,
    }));
    return {
      start,
      deadlineLondon: hoursAt(data.story.wager.deadline, start),
      places,
      departures,
      story: data.story,
    };
  }

  function initialState() {
    return {
      phase: 'club',
      place: 'london',
      hours: 0,
      bag: 20000,
      passepartout: true,
      aouda: false,
      kiouni: false,
      guide: false,
      goods: [],
      flags: {},
      detective: 0,
      crossedDateLine: false,
      whist: 0,
      readPaper: false,
      venue: '',
      ledger: [],
      visited: ['london'],
      diary: [],
      notice: '',
      kiouniOffer: 0,
      pace: 3,
      wind: 30,
      sail: false,
      sledgeTab: 'weather',
      ticket: null,
      ending: null,
    };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  /** The moment London's calendar shows, which is the diary less the day gained crossing the Pacific. */
  function londonHours(state) {
    return state.hours - (state.crossedDateLine ? 24 : 0);
  }

  function say(state, world, eventId) {
    const text = world.story.events[eventId]?.diary;
    if (text) state.diary.push({ at: state.hours, place: state.place, text });
    state.notice = text ?? '';
  }

  /** Spend time, with a Ledger row saying on what. Nothing moves the clock without one. */
  function spend(state, label, hours, extra = {}) {
    if (hours <= 0) return;
    state.ledger.push({ label, hours: Math.round(hours * 100) / 100, ...extra });
    state.hours += hours;
  }

  function place(world, id) {
    return world.places[id];
  }

  /** Whether a departure can be taken now, and if not, why. */
  function departureState(state, world, d) {
    if (d.hiddenIf && state.flags[d.hiddenIf]) return { offered: false, why: 'gone' };
    if (d.departsAt !== undefined && state.hours > d.departsAt) return { offered: false, why: 'sailed' };
    if (d.requires === 'kiouni' && !state.kiouni) return { offered: false, why: 'needs Kiouni' };
    if (d.cost && state.bag < d.cost) return { offered: true, affordable: false };
    return { offered: true, affordable: true };
  }

  /** The departures shown at the Quay: every one from here that has not sailed. */
  function departuresHere(state, world) {
    return world.departures
      .filter((d) => d.from === state.place)
      .map((d) => ({ d, ...departureState(state, world, d) }))
      .filter((x) => x.offered);
  }

  function hoursFor(state, d) {
    if (d.mode === 'elephant') {
      const pace = state.pace + (state.flags.sugar ? 1 : 0);
      return d.hours * (4 / (Math.min(pace, 6) + 1));
    }
    if (d.mode === 'sledge') {
      const knots = Math.max(state.wind, 5);
      return d.hours * (30 / knots) * (state.sail ? 1 : 3);
    }
    return d.hours;
  }

  function end(state, world, won, eventId, reason) {
    state.phase = 'ended';
    state.ending = { won, reason };
    say(state, world, eventId);
  }

  /** Lost if London's calendar has passed the deadline anywhere short of the Reform Club. */
  function checkDeadline(state, world) {
    if (state.phase !== 'travelling') return;
    if (londonHours(state) > world.deadlineLondon) {
      end(state, world, false, 'lost-late', `The eighty days ran out at ${place(world, state.place).name}.`);
    }
  }

  /**
   * Lost if nothing here can be taken: every sailing gone, or none paid for.
   * A place with nothing left to leave by would otherwise hold Fogg until the
   * clock ran out, which only a long run of stays at the Hotel ever reaches,
   * and the game promises a way on from every screen.
   */
  function checkWayOn(state, world) {
    if (state.phase !== 'travelling') return;
    const here = departuresHere(state, world);
    if (!here.length) {
      end(state, world, false, 'lost-no-way', `Nothing more leaves ${place(world, state.place).name} in time.`);
    } else if (here.every((x) => !x.affordable)) {
      end(state, world, false, 'lost-funds', `Fogg is without funds at ${place(world, state.place).name}.`);
    }
  }

  /** After anything that moves the clock at a place: the deadline first, then whether any way on is left. */
  function checkStanding(state, world) {
    checkDeadline(state, world);
    checkWayOn(state, world);
  }

  /** What happens on reaching a place. Each event's words and chapter are in data/story.json. */
  function arrive(state, world, from, d) {
    state.place = d.to;
    state.venue = '';
    state.kiouniOffer = 0;
    if (!state.visited.includes(d.to)) state.visited.push(d.to);
    state.notice = '';

    if (d.to === 'suez') say(state, world, 'suez-detective');
    if (d.to === 'kholby') say(state, world, 'kholby-end');
    if (d.to === 'pillaji') say(state, world, 'pillaji-procession');

    if (d.to === 'calcutta' && state.flags.temple) {
      say(state, world, 'calcutta-court');
      spend(state, 'The court at Calcutta', 4, { kind: 'delay' });
      state.bag -= BAIL;
    }
    if (d.to === 'yokohama' && !state.passepartout && state.flags.passepartoutOnCarnatic) {
      state.notice = 'Passepartout came here on the Carnatic, and is somewhere in the town.';
    }
    if (d.to === 'fortkearney') {
      say(state, world, 'fortkearney-attack');
      if (state.passepartout) {
        state.passepartout = false;
        state.flags.passepartoutCaptured = true;
      }
    }
    if (d.to === 'omaha' && d.mode === 'sledge' && !state.flags.furcoats) {
      say(state, world, 'sledge-cold');
      spend(state, 'Thawing out on the prairie', 3, { kind: 'delay' });
    }
    if (d.to === 'queenstown' && d.id === 'henrietta' && !state.flags.coal) {
      if (state.bag >= HENRIETTA_PRICE) {
        state.bag -= HENRIETTA_PRICE;
        say(state, world, 'henrietta-burned');
      } else {
        say(state, world, 'henrietta-drifts');
        spend(state, 'The Henrietta under sail, without coal', 96, { kind: 'delay' });
      }
    }
    if (d.to === 'liverpool') {
      const held = WARRANT_HOURS[Math.min(state.detective, WARRANT_HOURS.length - 1)];
      if (held > 0) {
        say(state, world, 'liverpool-warrant');
        spend(state, "Held on the Detective's warrant", held, { kind: 'delay' });
        say(state, world, 'liverpool-free');
      } else {
        say(state, world, 'liverpool-no-warrant');
      }
    }
    if (d.to === 'london') {
      reachLondon(state, world);
      return;
    }
    checkStanding(state, world);
  }

  function reachLondon(state, world) {
    state.phase = 'london';
    state.flags.believesLate = state.hours > hoursAt(world.story.wager.deadline, world.start);
    say(state, world, state.flags.believesLate ? 'london-late' : 'won');
  }

  /** Leave by a departure: wait for it if it sails later, then travel. */
  function travel(state, world, d, choices = {}) {
    const from = state.place;
    if (d.departsAt !== undefined && d.departsAt > state.hours) {
      spend(state, `Waiting at ${place(world, from).name} for the ${d.label.replace(/^[A-Z][a-z]+ (on |by |for )?(the )?/, '')}`, d.departsAt - state.hours, { kind: 'wait' });
    }
    const hours = d.arrivesAt !== undefined ? d.arrivesAt - state.hours : hoursFor(state, d);
    if (d.cost) state.bag -= d.cost;
    if (d.id === 'henrietta' && choices.coal) {
      state.bag -= COAL_PRICE;
      state.flags.coal = true;
    }
    if (d.crossesDateLine) state.crossedDateLine = true;

    // Leaving Suez, the Detective learns where Fogg is bound if Passepartout
    // took the passport. Leaving Hong Kong without Passepartout, he sails on
    // alone. Chapters VI and XIX.
    if (from === 'suez' && state.flags.servantVisa && !state.flags.detectiveKnows) {
      state.flags.detectiveKnows = true;
      state.detective += 1;
    }
    if (from === 'hongkong' && state.flags.tavern && state.passepartout) {
      state.passepartout = false;
      state.flags.passepartoutOnCarnatic = true;
      say(state, world, 'hongkong-missed');
    }
    if (from === 'kholby' || from === 'pillaji') {
      // Leaving Kiouni's country: the elephant stays behind at Allahabad.
      if (d.to === 'allahabad') state.kiouni = false;
    }

    spend(state, `${place(world, from).name} to ${place(world, d.to).name}`, hours, {
      kind: 'passage',
      mode: d.mode,
      from,
      to: d.to,
      departure: d.id,
    });
    arrive(state, world, from, d);
  }

  /** Apply one action and return the next state. The state passed in is never changed. */
  function act(stateIn, action, world) {
    const state = clone(stateIn);
    state.notice = '';
    const here = () => place(world, state.place);

    switch (action.type) {
      case 'whist':
        state.whist += 1;
        state.notice = `${world.story.club.whist} Rubbers played: ${state.whist}.`;
        break;
      case 'paper':
        state.readPaper = true;
        state.notice = world.story.club.newspaper;
        break;
      case 'accept':
        state.phase = 'travelling';
        state.notice = world.story.wager.terms;
        break;

      case 'venue':
        state.venue = action.venue;
        break;

      case 'take': {
        const d = world.departures.find((x) => x.id === action.departure);
        const status = d && d.from === state.place ? departureState(state, world, d) : { offered: false };
        if (!status.offered) {
          state.notice = 'That way is not open.';
          break;
        }
        if (!status.affordable) {
          state.notice = `The carpet-bag holds only ${pounds(state.bag)}.`;
          break;
        }
        if (d.ticket) {
          const party = 1 + (state.passepartout ? 1 : 0) + (state.aouda ? 1 : 0);
          state.ticket = { departure: d.id, berths: String(party), cabin: 'saloon', note: '', coal: false, message: '' };
        } else {
          travel(state, world, d);
        }
        break;
      }
      case 'berths':
        if (state.ticket) state.ticket.berths = String(action.value);
        break;
      case 'cabin':
        if (state.ticket) state.ticket.cabin = action.value;
        break;
      case 'note':
        if (state.ticket) state.ticket.note = String(action.value);
        break;
      case 'coal':
        if (state.ticket) state.ticket.coal = !!action.value;
        break;
      case 'book': {
        if (!state.ticket) break;
        const berths = Number(state.ticket.berths.trim());
        const party = 1 + (state.passepartout ? 1 : 0) + (state.aouda ? 1 : 0);
        // Refused until it is retyped, as a real ticket office would. The game
        // once corrected a bad count instead, which suited the engine rather
        // than the game: no value the engine typed was a count. It types "1"
        // and "2" now, and the arrow keys move the field; docs/HISTORY.md has
        // the measurement either way.
        if (!Number.isInteger(berths) || berths < 1 || berths > 3) {
          state.ticket.message = 'Berths must be a number from 1 to 3.';
          break;
        }
        if (berths < party) {
          state.ticket.message = `The party is ${party}; book ${party} berths.`;
          break;
        }
        const d = world.departures.find((x) => x.id === state.ticket.departure);
        const coal = state.ticket.coal;
        state.ticket = null;
        travel(state, world, d, { coal });
        break;
      }
      case 'cancel':
        state.ticket = null;
        break;

      case 'buy-good': {
        const id = action.good;
        if (state.goods.includes(id)) state.goods = state.goods.filter((g) => g !== id);
        else state.goods.push(id);
        break;
      }
      case 'use-good': {
        const id = action.good;
        if (!state.goods.includes(id)) break;
        state.flags[id] = true;
        state.goods = state.goods.filter((g) => g !== id);
        state.notice = `${world.story.goods.find((g) => g.id === id)?.label} put to use.`;
        break;
      }

      case 'visa':
        state.flags[`visa-${state.place}`] = true;
        if (state.place === 'suez') {
          if (action.by === 'servant') {
            state.flags.servantVisa = true;
            say(state, world, 'suez-servant-visa');
          } else {
            say(state, world, 'suez-own-visa');
          }
        } else {
          state.notice = `The passport is stamped at ${here().name}.`;
        }
        break;

      case 'stay': {
        const stays = { hour: 1, night: 12, sailing: undefined };
        let hours = stays[action.value];
        if (action.value === 'sailing') {
          const next = departuresHere(state, world)
            .map((x) => x.d.departsAt)
            .filter((t) => t !== undefined && t > state.hours)
            .sort((a, b) => a - b)[0];
          hours = next === undefined ? 0 : next - state.hours;
        }
        if (!hours) {
          state.notice = 'Nothing sails from here on a timetable.';
          break;
        }
        spend(state, `A stay at ${here().name}`, hours, { kind: 'wait' });
        state.notice = `Fogg waits ${durationText(hours)} at ${here().name}.`;
        checkStanding(state, world);
        break;
      }

      case 'telegraph': {
        const message = String(action.message ?? '').trim();
        if (!message) {
          state.notice = 'A telegram needs words.';
          break;
        }
        const key = `wire-${action.to}-${state.place}`;
        if (state.flags[key]) {
          state.notice = 'That telegram has already been sent from here.';
          break;
        }
        state.flags[key] = true;
        if (action.to === 'barings') {
          // A reply confirming Fogg's deposit weakens the case against him.
          if (state.detective > 0) state.detective -= 1;
          state.notice = "Baring's replies that Mr. Fogg's deposit stands. The Detective's case weakens.";
        } else if (action.to === 'scotlandyard') {
          state.detective += 1;
          state.notice = 'Scotland Yard wires the Detective where Fogg is.';
        } else {
          state.notice = 'The Reform Club acknowledges the telegram.';
        }
        state.diary.push({ at: state.hours, place: state.place, text: `A telegram to ${action.to}: "${message}"` });
        break;
      }

      case 'temple':
        state.flags.temple = true;
        say(state, world, 'bombay-temple');
        break;
      case 'tavern':
        if (!state.flags.tavern) {
          state.flags.tavern = true;
          state.detective += 1;
        }
        say(state, world, 'hongkong-tavern');
        break;
      case 'circus':
        if (!state.passepartout && state.flags.passepartoutOnCarnatic) {
          state.passepartout = true;
          state.flags.passepartoutOnCarnatic = false;
          spend(state, "The Honourable William Batulcar's circus", 3, { kind: 'delay' });
          say(state, world, 'yokohama-circus');
        } else {
          spend(state, "The Honourable William Batulcar's circus", 3, { kind: 'wait' });
          state.notice = 'The Long Noses perform. Nobody Fogg knows is among them.';
        }
        checkStanding(state, world);
        break;
      case 'soldiers':
        if (state.flags.passepartoutCaptured) {
          state.flags.passepartoutCaptured = false;
          state.passepartout = true;
          spend(state, 'After the war party with the soldiers', 12, { kind: 'delay' });
          say(state, world, 'fortkearney-rescue');
          checkStanding(state, world);
        }
        break;

      case 'offer':
        if (state.kiouni || state.place !== 'kholby') break;
        if (state.kiouniOffer < KIOUNI_OFFERS.length - 1 && action.raise) state.kiouniOffer += 1;
        state.notice =
          state.kiouniOffer === KIOUNI_OFFERS.length - 1
            ? `At ${pounds(KIOUNI_OFFERS.at(-1))} the owner yields.`
            : `${pounds(KIOUNI_OFFERS[state.kiouniOffer])} offered. The owner refuses.`;
        break;
      case 'buy-kiouni': {
        const price = KIOUNI_OFFERS[state.kiouniOffer];
        if (state.kiouni || state.kiouniOffer < KIOUNI_OFFERS.length - 1) {
          state.notice = 'The owner will not sell at that price.';
          break;
        }
        if (state.bag < price + (state.guide ? GUIDE_WAGE : 0)) {
          state.notice = `The carpet-bag holds only ${pounds(state.bag)}.`;
          break;
        }
        state.bag -= price;
        if (state.guide) state.bag -= GUIDE_WAGE;
        state.kiouni = true;
        say(state, world, 'kiouni-bought');
        break;
      }
      case 'guide':
        if (!state.kiouni) state.guide = !!action.value;
        break;
      case 'pace':
        state.pace = Math.max(1, Math.min(5, Number(action.value) || 3));
        break;

      case 'rescue':
        if (state.place !== 'pillaji' || state.aouda) break;
        if (!state.guide) {
          say(state, world, 'pillaji-no-guide');
          break;
        }
        state.aouda = true;
        spend(state, 'The rescue at the pagoda of Pillaji', 10, { kind: 'delay' });
        say(state, world, 'pillaji-rescue');
        checkStanding(state, world);
        break;

      case 'wind':
        state.wind = Math.max(0, Math.min(60, Number(action.value) || 0));
        break;
      case 'sail':
        state.sail = !!action.value;
        break;
      case 'sledge-tab':
        state.sledgeTab = action.value;
        break;

      case 'club':
        if (state.phase !== 'london') break;
        if (londonHours(state) <= world.deadlineLondon) {
          if (state.flags.believesLate) say(state, world, 'london-dateline');
          state.phase = 'ended';
          state.ending = {
            won: true,
            reason: `Fogg reached the Reform Club at ${clockText(londonHours(state), world.start)} by London's calendar.`,
          };
          if (state.flags.believesLate) state.diary.push({ at: state.hours, place: 'london', text: world.story.events.won.diary });
        } else {
          end(state, world, false, 'lost-late', `Fogg reached the Reform Club at ${clockText(londonHours(state), world.start)} by London's calendar, after the deadline.`);
        }
        break;

      case 'restart':
        if (state.phase === 'ended') return initialState();
        break;
    }
    return state;
  }

  /** The Ledger's figures, computed from its rows. The date-line check in stage two must not use this. */
  function ledgerTotals(state, world) {
    const hours = state.ledger.reduce((sum, row) => sum + row.hours, 0);
    return {
      hours,
      diary: clockText(hours, world.start),
      london: clockText(hours - (state.crossedDateLine ? 24 : 0), world.start),
      daysUsed: hours / 24,
    };
  }

  const EightyDays = {
    prepare,
    initialState,
    act,
    departuresHere,
    hoursFor,
    ledgerTotals,
    londonHours,
    clockText,
    durationText,
    pounds,
    partsAt,
    KIOUNI_OFFERS,
    GUIDE_WAGE,
    HENRIETTA_PRICE,
    COAL_PRICE,
  };
  root.EightyDays = EightyDays;
  if (typeof module !== 'undefined' && module.exports) module.exports = EightyDays;
})(typeof window !== 'undefined' ? window : globalThis);
