import { it } from 'vitest';
import { GUARDIANS } from '@shieldquest/shared';
import { guardianFacets, buildGuardianGeometry } from './models';
import { buildBeanGeometry, BEAN_HAIRS } from '../kit/beanGeometry';
it('stats', () => {
  for (const g of GUARDIANS) console.log(g.id, [1,2,3].map(l => `${guardianFacets(g.id,l).length}/${buildGuardianGeometry(g.id,l).getAttribute('position').count/3}`).join(' '));
  console.log('bean', BEAN_HAIRS.map(h => `${h}:${buildBeanGeometry({body:'#fff',accent:'#000',hair:h, glasses: true},'x').getAttribute('position').count/3}`).join(' '));
});
