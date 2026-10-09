import { POPUP_STATES } from '../fixtures/states';
import { CLASSROOM_PAGES } from '../fixtures/pages';
import { classroomHash, optionsHash, popupHash } from '../hash';

interface MapCell {
  href: string;
  title: string;
  description: string;
}

interface MapGroup {
  name: string;
  cells: MapCell[];
}

function popupCells(group: string): MapCell[] {
  return POPUP_STATES.filter((state) => state.group === group).map((state) => ({
    href: popupHash(state.id),
    title: state.label,
    description: state.description,
  }));
}

const CLASSROOM_DEMO_CELLS: MapCell[] = [
  {
    href: classroomHash('mixed-links-post-en', 'buttons'),
    title: 'Button states',
    description:
      'Real renderButton output on the mixed-links fixture: idle, loading, trying, success, error, cancelled, plus the group water fill.',
  },
  {
    href: `${classroomHash('stream-flagged-post-en')}&verdict=comment`,
    title: 'Flag pill: comment',
    description: 'Real renderFlagBadge with a comment verdict and a count of 5.',
  },
  {
    href: `${classroomHash('rtl-flagged-post-ar')}&verdict=both`,
    title: 'Flag pill: both (RTL)',
    description: 'The combined badge and red frame on the Arabic RTL fixture.',
  },
  {
    href: classroomHash('stream-flagged-post-en', 'copyright'),
    title: 'Copyright gate',
    description: 'The real one-time copyright dialog before a first classroom-wide run.',
  },
];

const GROUP_ORDER = [
  'First run',
  'First download',
  'Milestones',
  'Levels',
  'Queue',
  'History',
  'Changelog',
  'Storage integrity',
  'Engine selector',
  'Flag pills',
  'Legal',
  'Reduce motion',
  'Views',
];

/** Route "/" — the map: every simulatable state, grouped and deep-linked. */
export function MapRoute() {
  const groups: MapGroup[] = [
    ...GROUP_ORDER.map((name) => ({ name, cells: popupCells(name) })),
    {
      name: 'Classroom pages (Route B)',
      cells: [
        ...CLASSROOM_PAGES.map((page) => ({
          href: classroomHash(page.id),
          title: page.label,
          description: page.note,
        })),
        ...CLASSROOM_DEMO_CELLS,
      ],
    },
    {
      name: 'Options (permissions)',
      cells: [
        {
          href: optionsHash('permissions'),
          title: 'Permissions rows',
          description:
            'The real options page: the standing Permissions reference rows plus every settings toggle.',
        },
      ],
    },
  ].filter((group) => group.cells.length > 0);

  const total = groups.reduce((sum, group) => sum + group.cells.length, 0);

  return (
    <div className="sim-map" data-testid="state-map">
      <h1>CQD Simulator — state map</h1>
      <p>
        {total} states across {groups.length} groups. Each card deep-links the REAL
        extension surface with a fixture; nothing here is a lookalike rebuild.
      </p>
      <div className="sim-map-groups">
        {groups.map((group) => (
          <section key={group.name} className="sim-map-group" aria-label={group.name}>
            <h2>
              {group.name} <span className="sim-map-count">({group.cells.length})</span>
            </h2>
            <div className="sim-map-grid">
              {group.cells.map((cell) => (
                <a key={cell.href} className="sim-map-card" href={cell.href}>
                  <p className="sim-map-card-title">{cell.title}</p>
                  <p className="sim-map-card-desc">{cell.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
