import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const PRODUCTS = [
  {
    id: 'base',
    name: 'BASE TRANSMISSION',
    price: '$1.99',
    symbol: '◇',
    color: '#FF8C00',
    lines: [
      'Unlock all five broadcast bands.',
      'Access LIMINAL, LOST, CLASSIFIED,',
      'and ████████ frequencies.',
      '15 additional hand-authored calls.',
      'The full story. Every signal.',
    ],
    lockedText: 'LOCKED',
  },
  {
    id: 'infinite',
    name: 'INFINITE SIGNAL',
    price: '$0.99',
    symbol: '◉',
    color: '#CCFF00',
    lines: [
      'Unlimited AI-generated calls.',
      'Each one unique. Each one real.',
      'Powered by Claude.',
      'The frequency never goes quiet.',
    ],
    lockedText: 'LOCKED',
  },
];

export default function Store({ purchases, onPurchase, onClose }) {
  const [confirming, setConfirming] = useState(null);

  const handleBuy = (id) => {
    if (confirming === id) {
      onPurchase(id);
      setConfirming(null);
    } else {
      setConfirming(id);
    }
  };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.logo}>◈ DEAD AIR</Text>
          <Text style={s.subtitle}>SIGNAL STORE</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕ CLOSE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={s.intro}>
          {'Some frequencies require a key.\nThese transmissions are waiting.'}
        </Text>

        {PRODUCTS.map((p) => {
          const owned = purchases[`${p.id}Unlocked`];
          const isConfirming = confirming === p.id;

          return (
            <View key={p.id} style={[s.card, { borderColor: owned ? '#1a1a1a' : p.color }]}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardSymbol, { color: p.color }]}>{p.symbol}</Text>
                  <Text style={[s.cardName, { color: owned ? '#444' : '#e0e0e0' }]}>{p.name}</Text>
                </View>
                <Text style={[s.cardPrice, { color: owned ? '#2a2a2a' : p.color }]}>
                  {owned ? 'OWNED' : p.price}
                </Text>
              </View>

              <View style={s.divider} />

              {p.lines.map((line, i) => (
                <Text key={i} style={[s.cardLine, { color: owned ? '#333' : '#666' }]}>
                  {owned ? '─ ' : '◈ '}{line}
                </Text>
              ))}

              {!owned && (
                <TouchableOpacity
                  style={[
                    s.buyBtn,
                    { borderColor: isConfirming ? '#fff' : p.color },
                    isConfirming && { backgroundColor: '#0d0d0d' },
                  ]}
                  onPress={() => handleBuy(p.id)}
                >
                  <Text style={[s.buyBtnText, { color: isConfirming ? '#fff' : p.color }]}>
                    {isConfirming ? `CONFIRM PURCHASE — ${p.price}` : `UNLOCK — ${p.price}`}
                  </Text>
                </TouchableOpacity>
              )}

              {!owned && isConfirming && (
                <TouchableOpacity style={s.cancelBtn} onPress={() => setConfirming(null)}>
                  <Text style={s.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <Text style={s.footer}>
          {'Purchases are permanent.\nNo subscriptions. No tracking.\nJust signal.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030303',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  logo: {
    fontFamily: 'monospace',
    fontSize: 18,
    color: '#FF8C00',
    letterSpacing: 5,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#444',
    letterSpacing: 4,
    marginTop: 2,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#444',
    letterSpacing: 2,
  },
  intro: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 18,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardSymbol: {
    fontFamily: 'monospace',
    fontSize: 22,
    marginBottom: 4,
  },
  cardName: {
    fontFamily: 'monospace',
    fontSize: 15,
    letterSpacing: 2,
  },
  cardPrice: {
    fontFamily: 'monospace',
    fontSize: 18,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#111',
    marginVertical: 4,
  },
  cardLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
  },
  buyBtn: {
    borderWidth: 1,
    padding: 13,
    borderRadius: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  buyBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 2,
  },
  cancelBtn: {
    padding: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#333',
    letterSpacing: 2,
  },
  footer: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#2a2a2a',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
});
