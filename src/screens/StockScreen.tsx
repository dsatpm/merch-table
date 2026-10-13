import { useState, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, money, netCounts, variantKey, type Item, type Variant } from '../db';
import { Sheet } from '../Sheet';
import { stagger } from '../stagger';
import { IconArrowRight, IconBox, IconChevronRight, IconClose, IconPlus } from '../icons';

interface Draft {
  id?: number;
  name: string;
  price: string;
  variants: { name: string; startCount: string }[];
}

const emptyDraft = (): Draft => ({
  name: '',
  price: '',
  variants: [{ name: '', startCount: '' }],
});

export function StockScreen() {
  const items = useLiveQuery(() => db.items.orderBy('sortOrder').toArray(), []) ?? [];
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const sold = netCounts(events);

  const [draft, setDraft] = useState<Draft | null>(null);

  const edit = (item: Item) =>
    setDraft({
      id: item.id,
      name: item.name,
      price: String(item.price),
      variants: item.variants.map((v) => ({ name: v.name, startCount: String(v.startCount) })),
    });

  const save = async () => {
    if (!draft) return;
    const price = parseFloat(draft.price);
    const variants: Variant[] = draft.variants
      .filter((v) => v.name.trim() !== '' || v.startCount.trim() !== '')
      .map((v) => ({ name: v.name.trim(), startCount: parseInt(v.startCount, 10) || 0 }));
    if (!draft.name.trim() || isNaN(price) || price < 0) return;
    if (variants.length === 0) variants.push({ name: '', startCount: 0 });

    if (draft.id !== undefined) {
      await db.items.update(draft.id, { name: draft.name.trim(), price, variants });
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sortOrder), 0);
      await db.items.add({
        name: draft.name.trim(),
        price,
        variants,
        sortOrder: maxOrder + 1,
      });
    }
    setDraft(null);
  };

  const remove = async (item: Item) => {
    if (!confirm(`Delete "${item.name}"? Sales you already made will still be saved.`)) return;
    await db.items.delete(item.id!);
    setDraft(null);
  };

  const setVariant = (i: number, field: 'name' | 'startCount', value: string) => {
    if (!draft) return;
    const variants = draft.variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v));
    setDraft({ ...draft, variants });
  };

  const totalUnits = items.reduce(
    (sum, item) =>
      sum +
      item.variants.reduce(
        (s, v) => s + v.startCount - (sold.get(variantKey(item.id!, v.name)) ?? 0),
        0,
      ),
    0,
  );

  return (
    <div className="stock">
      <header className="screen-head reveal">
        <div>
          <span className="eyebrow">Inventory</span>
          <h1>Stock</h1>
        </div>
        {items.length > 0 && (
          <span className="eyebrow">
            {items.length} {items.length === 1 ? 'item' : 'items'} · {totalUnits} units
          </span>
        )}
      </header>

      {items.length === 0 && (
        <div className="empty">
          <span className="empty-icon reveal" style={stagger(1)}>
            <IconBox size={28} />
          </span>
          <p className="reveal" style={stagger(2)}>
            Add your merch at home before the show.
          </p>
          <p className="muted reveal" style={stagger(3)}>
            Everything is saved on this phone, so the app keeps working at the show with no signal.
          </p>
        </div>
      )}

      {items.map((item, i) => {
        const start = item.variants.reduce((s, v) => s + v.startCount, 0);
        const left = item.variants.reduce(
          (s, v) => s + v.startCount - (sold.get(variantKey(item.id!, v.name)) ?? 0),
          0,
        );
        const fill = start > 0 ? Math.min(1, Math.max(0, left / start)) : 0;
        return (
          <button
            key={item.id}
            className="stock-card reveal"
            style={stagger(i + 1)}
            onClick={() => edit(item)}
          >
            <span className="stock-card-body">
              <span className="stock-card-head">
                <span className="stock-card-name">{item.name}</span>
                <span className="stock-card-price">{money(item.price)}</span>
              </span>
              <span className={'meter' + (left <= 0 ? ' is-out' : '')} aria-hidden="true">
                <span className="meter-fill" style={{ '--fill': fill } as CSSProperties} />
              </span>
              <span className="variant-chips">
                {item.variants.map((v) => {
                  const vLeft = v.startCount - (sold.get(variantKey(item.id!, v.name)) ?? 0);
                  return (
                    <span
                      key={v.name}
                      className={'variant-chip' + (vLeft <= 0 ? ' is-out' : '')}
                    >
                      <b>{v.name || 'one size'}</b>
                      <span className="count">
                        {vLeft}/{v.startCount}
                      </span>
                    </span>
                  );
                })}
              </span>
            </span>
            <IconChevronRight size={18} />
          </button>
        );
      })}

      <button
        className="btn btn-primary btn-block has-icon stock-add reveal"
        style={stagger(items.length + 1)}
        onClick={() => setDraft(emptyDraft())}
      >
        Add item
        <span className="btn-icon">
          <IconPlus size={20} />
        </span>
      </button>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        label={draft?.id !== undefined ? 'Edit item' : 'New item'}
      >
        {draft && (
          <>
            <h2 className="sheet-title">{draft.id !== undefined ? 'Edit item' : 'New item'}</h2>
            <div className="sheet-body editor">
              <div className="editor-row">
                <label className="field">
                  Name
                  <input
                    className="input"
                    value={draft.name}
                    placeholder="Shirt, LP, Sticker…"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Price
                  <span className="input-wrap">
                    <span className="input-prefix">$</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={draft.price}
                      placeholder="25"
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    />
                  </span>
                </label>
              </div>

              <div className="variants-editor">
                <span className="field">Sizes or colors, and how many you have of each. Leave the name blank if there is only one kind.</span>
                {draft.variants.map((v, i) => (
                  <div key={i} className="variant-row">
                    <input
                      className="input"
                      value={v.name}
                      placeholder="Size / color"
                      aria-label={`Size or color ${i + 1} name`}
                      onChange={(e) => setVariant(i, 'name', e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={v.startCount}
                      placeholder="Count"
                      aria-label={`Size or color ${i + 1} count`}
                      onChange={(e) => setVariant(i, 'startCount', e.target.value)}
                    />
                    <button
                      className="icon-btn"
                      aria-label={`Remove size or color ${i + 1}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      <IconClose size={18} />
                    </button>
                  </div>
                ))}
                <button
                  className="btn add-variant"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: [...draft.variants, { name: '', startCount: '' }],
                    })
                  }
                >
                  <IconPlus size={18} />
                  Add size or color
                </button>
              </div>
            </div>

            <div className="sheet-actions">
              {draft.id !== undefined && (
                <button
                  className="btn btn-ghost btn-danger"
                  onClick={() => remove(items.find((i) => i.id === draft.id)!)}
                >
                  Delete
                </button>
              )}
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn btn-primary has-icon" onClick={save}>
                Save
                <span className="btn-icon">
                  <IconArrowRight size={18} />
                </span>
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
