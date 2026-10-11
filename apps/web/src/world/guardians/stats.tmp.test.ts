import { it } from 'vitest';
import { GUARDIANS } from '@shieldquest/shared';
import { guardianFacets, buildGuardianGeometry } from './models';
import { buildBeanGeometry, BEAN_HAIRS } from '../kit/beanGeometry';
it('stats', () => {
  const out: string[] = [];
  for (const g of GUARDIANS) out.push(g.id + ' ' + [1,2,3].map(l => `${guardianFacets(g.id,l).length}/${buildGuardianGeometry(g.id,l).getAttribute('position').count/3}`).join(' '));
  out.push('bean ' + BEAN_HAIRS.map(h => `${h}:${buildBeanGeometry({body:'#fff',accent:'#000',hair:h, glasses: true},'x').getAttribute('position').count/3}`).join(' '));
  throw new Error(out.join('\n'));
});
