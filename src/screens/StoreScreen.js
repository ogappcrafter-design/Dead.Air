import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

import Button from '../components/Button';
import CRT from '../components/CRT';
import { MARK } from '../content/symbols';
import { PRODUCT_LIST, isOwned, isStoreOpen } from '../services/billing';
import { colors, mono, safeTop } from '../theme/theme';

/** Two one-time purchases. Billing itself lives behind src/services/billing.js. */
export default function StoreScreen({ purchases, onBuy, onRestore, onClose, busy, error }) {
  const [confirming, setConfirming] = useState(null);
  const open = isStoreOpen();

  const press = (id) => {
    if (confirming === id) {
      setConfirming(null);
      onBuy(id);
    } else {
      setConfirming(id);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View>
          <Text style={s.logo}>{MARK} DEAD AIR</Text>
          <Text style={s.sub}>SIGNAL STORE</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={s.close}>
          <Text style={s.closeText}>✕ CLOSE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 96 }}>
        <Text style={s.intro}>{'Some frequencies require a key.\nThese transmissions are waiting.'}</Text>

        {!open && (
          <View style={s.notice}>
            <Text style={s.noticeText}>
              THE STORE IS NOT OPEN YET. These transmissions cannot be unlocked in this build.
            </Text>
          </View>
        )}

        {PRODUCT_LIST.map((product) => {
          const owned = isOwned(purchases, product.id);
          const isConfirming = confirming === product.id;

          return (
            <View
              key={product.id}
              style={[s.card, { borderColor: owned ? colors.line : product.color }]}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.symbol, { color: product.color }]}>{product.symbol}</Text>
                  <Text style={[s.name, { color: owned ? colors.textFaint : colors.text }]}>
                    {product.name}
                  </Text>
                </View>
                <Text style={[s.price, { color: owned ? colors.lineBright : product.color }]}>
                  {owned ? 'OWNED' : product.price}
                </Text>
              </View>

              <View style={s.divider} />

              {product.lines.map((line, i) => (
                <Text key={i} style={[s.line, { color: owned ? colors.textGhost : '#666' }]}>
                  {owned ? '─ ' : `${MARK} `}
                  {line}
                </Text>
              ))}

              {!owned && (
                <Button
                  label={
                    !open
                      ? 'UNAVAILABLE'
                      : isConfirming
                        ? `CONFIRM PURCHASE — ${product.price}`
                        : `UNLOCK — ${product.price}`
                  }
                  disabled={busy || !open}
                  color={isConfirming ? colors.white : product.color}
                  style={{ marginTop: 8 }}
                  onPress={() => press(product.id)}
                />
              )}

              {!owned && isConfirming && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setConfirming(null)}
                  style={s.cancel}
                >
                  <Text style={s.cancelText}>CANCEL</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {!!error && <Text style={s.error}>{error}</Text>}

        <Button label="RESTORE PURCHASES" tone="quiet" disabled={busy || !open} onPress={onRestore} />

        <Text style={s.footer}>
          {'Purchases are permanent.\nNo subscriptions. No tracking.\nJust signal.'}
        </Text>
      </ScrollView>

      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: safeTop,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  logo: { fontFamily: mono, fontSize: 18, letterSpacing: 5, color: colors.amber },
  sub: { fontFamily: mono, fontSize: 10, letterSpacing: 4, color: colors.textFaint, marginTop: 2 },
  close: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  intro: {
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textFaint,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: { borderWidth: 1, borderRadius: 2, padding: 18, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbol: { fontFamily: mono, fontSize: 22, marginBottom: 4 },
  name: { fontFamily: mono, fontSize: 15, letterSpacing: 2 },
  price: { fontFamily: mono, fontSize: 18, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 4 },
  line: { fontFamily: mono, fontSize: 12, lineHeight: 20 },
  cancel: { padding: 10, alignItems: 'center' },
  cancelText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textGhost },
  error: { fontFamily: mono, fontSize: 12, color: colors.red, textAlign: 'center' },
  notice: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 2,
    padding: 12,
  },
  noticeText: { fontFamily: mono, fontSize: 11, lineHeight: 18, color: colors.red },
  footer: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1,
    color: colors.textVoid,
    textAlign: 'center',
    marginTop: 12,
  },
});
