// The live mission list for the educator guide. Loaded on demand so the mission scripts never
// weigh down the rest of the public site.
import { BANDS, DISTRICTS, MISSIONS, districtById, type BandId, type DistrictId, type Mission } from '@shieldquest/shared';
import { StatusBadge } from '../../ui/StatusBadge';
import { accent } from '../parts';

const SCAFFOLD: Record<Mission['scaffold'], string> = {
  guided: 'Guided',
  light: 'Light',
  wildcard: 'Wildcard',
};

interface CatalogueRow {
  key: string;
  title: string;
  theme: string;
  district: DistrictId;
  bands: Set<BandId>;
  scaffold: Mission['scaffold'];
  peerShield: boolean;
  reviewed: boolean;
}

/** Band variants share a title and district, so they collapse into one row with every band listed. */
function catalogue(): CatalogueRow[] {
  const rows = new Map<string, CatalogueRow>();
  for (const m of MISSIONS) {
    const key = `${m.district}:${m.title}`;
    const row = rows.get(key);
    if (row) {
      m.bands.forEach((b) => row.bands.add(b));
      row.peerShield ||= Boolean(m.peerShield);
      row.reviewed &&= m.review.status === 'reviewed';
    } else {
      rows.set(key, {
        key,
        title: m.title,
        theme: m.theme,
        district: m.district,
        bands: new Set(m.bands),
        scaffold: m.scaffold,
        peerShield: Boolean(m.peerShield),
        reviewed: m.review.status === 'reviewed',
      });
    }
  }
  const order = DISTRICTS.map((d) => d.id);
  return [...rows.values()].sort((a, b) => order.indexOf(a.district) - order.indexOf(b.district));
}

export default function MissionCatalogue() {
  const rows = catalogue();
  const upcoming = DISTRICTS.filter((d) => d.comingSoon);
  return (
    <>
      <div className="site-tablewrap">
        <table className="site-table site-table--missions">
          <caption>
            Missions available now <span className="site-table__count">({rows.length})</span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Mission</th>
              <th scope="col">District</th>
              <th scope="col">Bands</th>
              <th scope="col">Style</th>
              <th scope="col">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = districtById(r.district);
              return (
                <tr key={r.key}>
                  <th scope="row">
                    <span className="site-table__title">{r.title}</span>
                    <span className="site-table__sub">{r.theme}</span>
                  </th>
                  <td data-label="District">
                    <span className="site-district" style={accent(d.color)}>
                      {d.name}
                    </span>
                  </td>
                  <td data-label="Bands">
                    <ul className="site-bandchips">
                      {BANDS.filter((b) => r.bands.has(b.id)).map((b) => (
                        <li key={b.id}>
                          {b.label} <small>{b.ages}</small>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td data-label="Style">
                    {SCAFFOLD[r.scaffold]}
                    {r.peerShield && <span className="site-table__sub">with Peer Shield</span>}
                  </td>
                  <td data-label="Review">
                    {r.reviewed ? <StatusBadge status="safe" label="Reviewed" /> : <StatusBadge status="attention" label="In review" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {upcoming.length > 0 && (
        <p className="site-fineprint site-catalogue__foot">
          Still under fog on the map: {upcoming.map((d) => d.name).join(' and ')}. These districts open when new missions
          have passed both reviews.
        </p>
      )}
    </>
  );
}
