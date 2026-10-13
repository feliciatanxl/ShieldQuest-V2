// Red-Flag Wordsearch. Find the warning words from the message in the grid by dragging across them,
// tapping the first and last letter, or with the keyboard (arrows to move, Enter on the first and last letter).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { WORDSEARCH_GRID, hashSeed, messageFor, mulberry32, type BandId, type WordsearchPuzzle } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { StatusShape } from '../../../ui/StatusBadge';
import { LiveRegion, MessageCard, useAnnounce, useArcadeCues, type GameProps } from '../shared';
import {
  generateGrid,
  idx,
  lineCells,
  matchSelection,
  readCells,
  sameCell,
  segmentMessage,
  snapLine,
  wordBlank,
  wordsearchScore,
  type Cell,
} from '../wordsearchLogic';

const COLORS = 5;

interface Props extends GameProps<{ puzzle: WordsearchPuzzle }> {
  band: BandId;
}

export function Wordsearch({ round, seed, band, plain, onComplete, onResults }: Props) {
  const { puzzle } = round;
  const spec = WORDSEARCH_GRID[band];
  const words = useMemo(() => puzzle.flags.map((f) => f.word), [puzzle]);
  const grid = useMemo(
    () => generateGrid(words, spec.size, spec.directions, mulberry32(hashSeed(puzzle.id, seed))),
    [words, spec, puzzle.id, seed],
  );
  const cues = useArcadeCues();
  const [live, announce] = useAnnounce();

  const [found, setFound] = useState<{ word: string; cells: Cell[] }[]>([]);
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [drag, setDrag] = useState<Cell[] | null>(null);
  const [cursor, setCursor] = useState<Cell>({ r: 0, c: 0 });
  const [ended, setEnded] = useState<null | 'all' | 'gave-up'>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [showWords, setShowWords] = useState(spec.showWords);
  const [lastFound, setLastFound] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<{ start: Cell; moved: boolean; line: Cell[] } | null>(null);
  const keyNav = useRef(false);

  const foundWords = found.map((f) => f.word);
  const colorOf = (word: string) => foundWords.indexOf(word) % COLORS;
  const message = messageFor(puzzle, plain);
  const segments = useMemo(() => segmentMessage(message, words), [message, words]);

  // Which found word (if any) covers each cell, for colouring. Later finds paint over earlier ones.
  const cellWord = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of found) for (const cell of f.cells) m.set(idx(grid.size, cell), f.word);
    return m;
  }, [found, grid.size]);
  const revealed = useMemo(() => {
    if (ended !== 'gave-up') return new Set<number>();
    return new Set(
      grid.placements.filter((p) => !foundWords.includes(p.word)).flatMap((p) => p.cells.map((cell) => idx(grid.size, cell))),
    );
  }, [ended, grid, foundWords]);

  const preview = useMemo(() => {
    if (drag) return new Set(drag.map((cell) => idx(grid.size, cell)));
    return new Set<number>();
  }, [drag, grid.size]);

  useEffect(() => {
    if (!keyNav.current) return;
    keyNav.current = false;
    cellRefs.current[idx(grid.size, cursor)]?.focus();
  }, [cursor, grid.size]);

  const finish = (how: 'all' | 'gave-up', nowFound: { word: string; cells: Cell[] }[]) => {
    setEnded(how);
    setAnchor(null);
    setDrag(null);
    setHint(null);
    const got = new Set(nowFound.map((f) => f.word));
    onComplete({
      score: wordsearchScore(got.size, words.length),
      right: got.size,
      total: words.length,
      unit: 'red flags found',
      lesson: puzzle.lesson,
      review: puzzle.flags.map((f) => ({ id: f.word, ok: got.has(f.word), title: f.word, detail: f.why })),
    });
    if (how === 'all') {
      cues.done();
      announce(`All ${words.length} red flags found! Press See my Stars when you are ready.`);
    } else {
      announce(`Round over. You found ${got.size} of ${words.length}. The rest are now outlined in the grid.`);
    }
  };

  const trySelect = (cells: Cell[]) => {
    if (ended) return;
    const word = matchSelection(grid, cells, words, foundWords);
    if (!word) {
      const read = readCells(grid, cells);
      const text = `${read.length > 1 ? `${read} is` : 'That is'} not one of the red-flag words. Try another line.`;
      setHint(text);
      cues.miss();
      announce(text);
      return;
    }
    const next = [...found, { word, cells }];
    setFound(next);
    setLastFound(word);
    setHint(null);
    const why = puzzle.flags.find((f) => f.word === word)?.why ?? '';
    if (next.length === words.length) {
      finish('all', next);
    } else {
      cues.good();
      announce(`Found ${word}! ${why} ${words.length - next.length} to go.`);
    }
  };

  /** Tap (or Enter) on a cell: first tap sets the start, second tap the end. */
  const tapCell = (cell: Cell) => {
    if (ended) return;
    if (!anchor) {
      setAnchor(cell);
      cues.tap();
      setHint(`Start: ${readCells(grid, [cell])}. Now pick the last letter of the word.`);
      announce(`Start: ${readCells(grid, [cell])}. Now pick the last letter of the word.`);
      return;
    }
    if (sameCell(anchor, cell)) {
      setAnchor(null);
      setHint(null);
      announce('Start cleared.');
      return;
    }
    const line = lineCells(anchor, cell);
    if (!line) {
      setAnchor(cell);
      const text = `Not in a straight line, so ${readCells(grid, [cell])} is your new start.`;
      setHint(text);
      announce(text);
      return;
    }
    setAnchor(null);
    trySelect(line);
  };

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * grid.size);
    const r = Math.floor(((y - rect.top) / rect.height) * grid.size);
    if (r < 0 || c < 0 || r >= grid.size || c >= grid.size) return null;
    return { r, c };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (ended || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture on synthetic events; dragging still works within the grid.
    }
    dragRef.current = { start: cell, moved: false, line: [cell] };
    setCursor(cell);
    setDrag([cell]);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    if (!sameCell(cell, d.start)) d.moved = true;
    d.line = snapLine(d.start, cell, grid.size);
    setDrag(d.line);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const line = d.line;
    if (d.moved && line.length > 1) {
      setAnchor(null);
      trySelect(line);
    } else {
      const cell = cellFromPoint(e.clientX, e.clientY) ?? d.start;
      tapCell(cell);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const m = move[e.key];
    if (m) {
      e.preventDefault();
      keyNav.current = true;
      setCursor((c) => ({ r: Math.min(grid.size - 1, Math.max(0, c.r + m[0])), c: Math.min(grid.size - 1, Math.max(0, c.c + m[1])) }));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      keyNav.current = true;
      setCursor((c) => ({ r: c.r, c: e.key === 'Home' ? 0 : grid.size - 1 }));
      return;
    }
    if (e.key === 'Escape' && anchor) {
      e.preventDefault();
      setAnchor(null);
      announce('Start cleared.');
      return;
    }
    // Enter and Space activate the focused letter button natively (a click with detail 0), handled below.
  };

  // While a start is set, show the line from it to the keyboard cursor as a preview.
  const keyPreview = useMemo(() => {
    if (!anchor || drag) return new Set<number>();
    const line = lineCells(anchor, cursor);
    return new Set((line ?? []).map((cell) => idx(grid.size, cell)));
  }, [anchor, cursor, drag, grid.size]);

  const lastWhy = lastFound ? puzzle.flags.find((f) => f.word === lastFound)?.why : null;

  return (
    <div className={`arc-ws${ended ? ' is-ended' : ''}`}>
      <LiveRegion text={live} />
      <section className="arc-ws__msg" aria-labelledby="arc-ws-msg-h">
        <h2 id="arc-ws-msg-h" className="arc-section-title">
          Spot the red flags
        </h2>
        <MessageCard channel={puzzle.channel} from={puzzle.from} meta={puzzle.meta}>
          <p>
            {segments.map((s, i) => {
              if (!s.word) return <span key={i}>{s.text}</span>;
              const isFound = foundWords.includes(s.word);
              if (isFound) {
                return (
                  <mark key={i} className="arc-mark" data-color={colorOf(s.word)}>
                    {s.text}
                    <span className="sr-only"> (red flag found)</span>
                  </mark>
                );
              }
              if (ended === 'gave-up') {
                return (
                  <mark key={i} className="arc-mark arc-mark--missed">
                    {s.text}
                    <span className="sr-only"> (red flag)</span>
                  </mark>
                );
              }
              return <span key={i}>{s.text}</span>;
            })}
          </p>
        </MessageCard>
        {lastWhy && !ended && (
          <p className="arc-ws__why" key={lastFound}>
            <StatusShape status="risk" size={18} /> <strong>{lastFound}:</strong> {lastWhy}
          </p>
        )}
      </section>

      <section className="arc-ws__board" aria-labelledby="arc-ws-grid-h">
        <h2 id="arc-ws-grid-h" className="sr-only">
          Letter grid
        </h2>
        <p className="arc-ws__how" id="arc-ws-how">
          Drag across a word, or tap its first letter then its last.
          <span className="arc-ws__how-keys"> Keyboard: arrow keys to move, Enter on the first and last letter.</span>
        </p>
        <div className="arc-ws__gridwrap">
          <div
            ref={gridRef}
            className="arc-ws__grid"
            role="grid"
            aria-label={`Letter grid, ${grid.size} by ${grid.size}`}
            aria-describedby="arc-ws-how"
            style={{ ['--n' as string]: grid.size }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragRef.current = null;
              setDrag(null);
            }}
            onKeyDown={onKeyDown}
          >
            {Array.from({ length: grid.size }, (_, r) => (
              <div role="row" key={r} className="arc-ws__row">
                {Array.from({ length: grid.size }, (_, c) => {
                  const i = r * grid.size + c;
                  const letter = grid.letters[i]!;
                  const w = cellWord.get(i);
                  const isAnchor = anchor && anchor.r === r && anchor.c === c;
                  const isCursor = cursor.r === r && cursor.c === c;
                  const cls = [
                    'arc-ws__cell',
                    w ? 'is-found' : '',
                    preview.has(i) || keyPreview.has(i) ? 'is-selecting' : '',
                    isAnchor ? 'is-anchor' : '',
                    revealed.has(i) ? 'is-revealed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const state = [w ? `part of ${w}` : '', isAnchor ? 'start' : '', revealed.has(i) ? 'hidden word' : '']
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div role="gridcell" key={c} className="arc-ws__gc" aria-selected={isAnchor ? true : undefined}>
                      <button
                        ref={(el) => {
                          cellRefs.current[i] = el;
                        }}
                        type="button"
                        tabIndex={isCursor ? 0 : -1}
                        className={cls}
                        data-color={w ? colorOf(w) : undefined}
                        aria-label={`${letter}, row ${r + 1}, column ${c + 1}${state ? `, ${state}` : ''}`}
                        onFocus={() => setCursor({ r, c })}
                        // Mouse and touch go through the grid's pointer events. Keyboard (Enter/Space), screen readers and
                        // switch access send a plain click (detail 0), which counts as a tap.
                        onClick={(e) => {
                          if (e.detail === 0) tapCell({ r, c });
                        }}
                      >
                        <span aria-hidden="true">{letter}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="arc-ws__hint" aria-hidden="true">
          {hint ?? ' '}
        </p>
      </section>

      <section className="arc-ws__list" aria-labelledby="arc-ws-list-h">
        <div className="arc-ws__listhead">
          <h2 id="arc-ws-list-h" className="arc-section-title">
            Red flags: {found.length} of {words.length}
          </h2>
          {!spec.showWords && !ended && (
            <Button variant="ghost" size="sm" aria-pressed={showWords} onClick={() => setShowWords((v) => !v)}>
              {showWords ? 'Hide words' : 'Show words'}
            </Button>
          )}
        </div>
        <ul className="arc-ws__words">
          {puzzle.flags.map((f) => {
            const isFound = foundWords.includes(f.word);
            const visible = isFound || showWords || ended;
            return (
              <li key={f.word} className={isFound ? 'is-found' : ended ? 'is-missed' : ''} data-color={isFound ? colorOf(f.word) : undefined}>
                <span className="arc-ws__wordtag">
                  <StatusShape status={isFound ? 'safe' : ended ? 'attention' : 'unknown'} size={16} />
                  {visible ? (
                    <strong>{f.word}</strong>
                  ) : (
                    <strong aria-label={`${f.word.length}-letter word starting with ${f.word[0]}`}>
                      <span aria-hidden="true">{wordBlank(f.word)}</span>
                    </strong>
                  )}
                </span>
                {(isFound || ended) && <span className="arc-ws__wordwhy">{f.why}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="arc-actions arc-actions--sticky">
        {ended ? (
          <>
            <p className="arc-ws__banner" role="status">
              {ended === 'all' ? `All ${words.length} red flags found!` : 'Here is where the rest were hiding.'}
            </p>
            <Button size="lg" iconRight="arrowRight" onClick={onResults}>
              See my Stars
            </Button>
          </>
        ) : confirmGiveUp ? (
          <>
            <p className="arc-ws__banner">
              End the round and show the answers? You keep {found.length} of {words.length}.
            </p>
            <Button variant="secondary" onClick={() => setConfirmGiveUp(false)}>
              Keep looking
            </Button>
            <Button variant="paper" onClick={() => finish('gave-up', found)}>
              Yes, show me
            </Button>
          </>
        ) : (
          <>
            {anchor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAnchor(null);
                  setHint(null);
                }}
              >
                Clear start
              </Button>
            )}
            <Button variant="secondary" icon="eye" onClick={() => setConfirmGiveUp(true)}>
              Show me the answers
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
