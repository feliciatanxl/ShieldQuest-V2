// Fictional mock screens for Real or Fake? (text, chat, pop-up, email, shop, job post, notice, app message).
// Realistic enough to practise on, clearly not any real brand. Mock buttons are drawn, never clickable.
import type { ReactNode } from 'react';
import { cardBodyFor, type CardField, type CardKind, type RealOrFakeCard } from '@shieldquest/shared';
import { Icon, type IconName } from '../../../ui/Icon';

const KIND_LABEL: Record<CardKind, string> = {
  sms: 'Text message',
  chat: 'Chat message',
  popup: 'Website pop-up',
  email: 'Email',
  shop: 'Shop page',
  job: 'Job post',
  notice: 'Notice',
  app: 'App message',
};

const KIND_ICON: Record<CardKind, IconName> = {
  sms: 'phone',
  chat: 'chat',
  popup: 'external',
  email: 'envelope',
  shop: 'pin',
  job: 'user',
  notice: 'book',
  app: 'spark',
};

/** Wraps the clue text in a highlight once the call has been made. */
function withClue(text: string, field: CardField, card: RealOrFakeCard, show: boolean): ReactNode {
  if (!show || card.clue.field !== field) return text;
  const at = text.indexOf(card.clue.text);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className={`arc-clue arc-clue--${card.verdict}`}>
        <span className="sr-only">Giveaway: </span>
        {card.clue.text}
      </mark>
      {text.slice(at + card.clue.text.length)}
    </>
  );
}

export function MockScreen({ card, plain, reveal }: { card: RealOrFakeCard; plain: boolean; reveal: boolean }) {
  const body = cardBodyFor(card, plain);
  const t = (field: CardField, text: string) => withClue(text, field, card, reveal);
  const initial = card.from.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?';

  const cta = card.cta ? (
    <span className="arc-mock__cta">
      <span className="sr-only">Button on the screen: </span>
      {t('cta', card.cta)}
    </span>
  ) : null;

  const metaLine = card.meta ? <span className="arc-mock__meta">{t('meta', card.meta)}</span> : null;

  let inner: ReactNode;
  switch (card.kind) {
    case 'sms':
    case 'chat':
      inner = (
        <>
          <div className="arc-mock__bar">
            <span className="arc-mock__avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="arc-mock__who">
              <strong>{t('from', card.from)}</strong>
              {metaLine}
            </span>
          </div>
          <div className="arc-mock__thread">
            <p className="arc-mock__bubble">{t('body', body)}</p>
            {cta}
          </div>
        </>
      );
      break;
    case 'app':
      inner = (
        <>
          <div className="arc-mock__notif">
            <span className="arc-mock__appicon" aria-hidden="true">
              {initial}
            </span>
            <span className="arc-mock__who">
              <strong>{t('from', card.from)}</strong>
              {metaLine}
            </span>
          </div>
          <p className="arc-mock__text">{t('body', body)}</p>
          {cta}
        </>
      );
      break;
    case 'popup':
    case 'shop':
      inner = (
        <>
          <div className="arc-mock__url">
            <Icon name="external" size="0.95em" />
            {card.meta ? t('meta', card.meta) : 'website'}
          </div>
          <div className="arc-mock__page">
            {card.kind === 'popup' && (
              <span className="arc-mock__x" aria-hidden="true">
                <Icon name="close" size="0.9em" />
              </span>
            )}
            <strong className="arc-mock__title">{t('from', card.from)}</strong>
            {card.kind === 'shop' && (
              <span className="arc-mock__product" aria-hidden="true">
                <Icon name="pin" size="1.6em" />
              </span>
            )}
            <p className="arc-mock__text">{t('body', body)}</p>
            {cta}
          </div>
        </>
      );
      break;
    case 'email':
      inner = (
        <>
          <div className="arc-mock__mailhead">
            <span>
              <small>From</small> <strong>{t('from', card.from)}</strong>
            </span>
            {card.meta && <span className="arc-mock__meta">{t('meta', card.meta)}</span>}
          </div>
          <p className="arc-mock__text">{t('body', body)}</p>
          {cta}
        </>
      );
      break;
    case 'job':
      inner = (
        <>
          <strong className="arc-mock__title">{t('from', card.from)}</strong>
          {metaLine}
          <p className="arc-mock__text">{t('body', body)}</p>
          {cta}
        </>
      );
      break;
    case 'notice':
      inner = (
        <>
          <span className="arc-mock__pin" aria-hidden="true" />
          <strong className="arc-mock__title">{t('from', card.from)}</strong>
          {metaLine}
          <p className="arc-mock__text">{t('body', body)}</p>
          {cta}
        </>
      );
      break;
  }

  return (
    <figure className={`arc-mock arc-mock--${card.kind}`} aria-label={`Fictional ${KIND_LABEL[card.kind].toLowerCase()} from ${card.from}`}>
      <figcaption className="arc-mock__kind">
        <Icon name={KIND_ICON[card.kind]} size="1em" />
        {KIND_LABEL[card.kind]}
      </figcaption>
      <div className="arc-mock__screen">{inner}</div>
    </figure>
  );
}
