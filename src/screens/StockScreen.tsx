import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, money, netCounts, variantKey, type Item, type Variant } from '../db';

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
    if (!confirm(`Delete "${item.name}"? Past sales stay in the log.`)) return;
    await db.items.delete(item.id!);
    setDraft(null);
  };

  const setVariant = (i: number, field: 'name' | 'startCount', value: string) => {
    if (!draft) return;
    const variants = draft.variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v));
    setDraft({ ...draft, variants });
  };

  return (
    <div className="stock">
      {items.length === 0 && !draft && (
        <div className="empty">
          <p>Set up your merch at home, on wifi.</p>
          <p className="muted">Everything lives on this device — works fully offline at the show.</p>
        </div>
      )}

      {items.map((item) => (
        <button key={item.id} className="stock-row" onClick={() => edit(item)}>
          <div className="stock-row-head">
            <strong>{item.name}</strong>
            <span>{money(item.price)}</span>
          </div>
          <div className="stock-row-variants muted">
            {item.variants
              .map((v) => {
                const left = v.startCount - (sold.get(variantKey(item.id!, v.name)) ?? 0);
                return `${v.name || 'one size'}: ${left}/${v.startCount}`;
              })
              .join('  ·  ')}
          </div>
        </button>
      ))}

      {draft ? (
        <div className="editor">
          <h3>{draft.id !== undefined ? 'Edit item' : 'New item'}</h3>
          <label>
            Name
            <input
              value={draft.name}
              placeholder="Shirt, LP, Sticker…"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Price
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={draft.price}
              placeholder="25"
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </label>
          <div className="variants-editor">
            <span className="label-text">Variants + starting count (leave name blank for one-size)</span>
            {draft.variants.map((v, i) => (
              <div key={i} className="variant-row">
                <input
                  value={v.name}
                  placeholder="Size / color"
                  onChange={(e) => setVariant(i, 'name', e.target.value)}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={v.startCount}
                  placeholder="Count"
                  onChange={(e) => setVariant(i, 'startCount', e.target.value)}
                />
                <button
                  className="ghost small"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: draft.variants.filter((_, idx) => idx !== i),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="ghost"
              onClick={() =>
                setDraft({ ...draft, variants: [...draft.variants, { name: '', startCount: '' }] })
              }
            >
              + Add variant
            </button>
          </div>
          <div className="modal-actions">
            {draft.id !== undefined && (
              <button className="danger ghost" onClick={() => remove(items.find((i) => i.id === draft.id)!)}>
                Delete
              </button>
            )}
            <button className="ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <button className="primary big" onClick={() => setDraft(emptyDraft())}>
          + Add item
        </button>
      )}
    </div>
  );
}
