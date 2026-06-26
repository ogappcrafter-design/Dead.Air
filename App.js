import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Game from './components/game';
import Store from './components/Store';
import Pick3Screen from './components/Pick3Screen';

const SAVE_KEY = 'dead_air_save_v1';
const PURCHASE_KEY = 'dead_air_purchases_v1';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [saveData, setSaveData] = useState({
    sanity:100, bal:0, done:[], tapes:[], genCount:0
  });
  const [purchases, setPurchases] = useState({
    baseUnlocked:false, infiniteUnlocked:false
  });
  const [storeOpen, setStoreOpen] = useState(false);
  const [pick3Open, setPick3Open] = useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const s = await AsyncStorage.getItem(SAVE_KEY);
        const p = await AsyncStorage.getItem(PURCHASE_KEY);
        if(s) setSaveData(JSON.parse(s));
        if(p) setPurchases(JSON.parse(p));
      } catch(e){}
      setLoaded(true);
    })();
  },[]);

  const persistSave = async(data) => {
    setSaveData(data);
    try { await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e){}
  };

  const persistPurchases = async(p) => {
    setPurchases(p);
    try { await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(p)); } catch(e){}
  };

  if(!loaded) return (
    <View style={styles.loading}>
      <Text style={styles.loadText}>◈ DEAD AIR RADIO</Text>
      <ActivityIndicator color="#FF8C00" style={{marginTop:20}}/>
    </View>
  );

  if(pick3Open) return (
    <Pick3Screen onClose={()=>setPick3Open(false)} />
  );

  if(storeOpen) return (
    <Store
      purchases={purchases}
      onPurchase={(product)=>{
        const updated = product==='base'
          ? {...purchases, baseUnlocked:true}
          : product==='infinite'
          ? {...purchases, infiniteUnlocked:true}
          : purchases;
        persistPurchases(updated);
        setStoreOpen(false);
      }}
      onClose={()=>setStoreOpen(false)}
    />
  );

  return (
    <Game
      saveData={saveData}
      purchases={purchases}
      onSave={persistSave}
      onOpenStore={()=>setStoreOpen(true)}
      onOpenPick3={()=>setPick3Open(true)}
      onPurchaseInfinite={()=>persistPurchases({...purchases,infiniteUnlocked:true})}
    />
  );
}

const styles = StyleSheet.create({
  loading:{
    flex:1,
    backgroundColor:'#030303',
    alignItems:'center',
    justifyContent:'center',
  },
  loadText:{
    fontFamily:'monospace',
    fontSize:22,
    color:'#FF8C00',
    letterSpacing:6,
  }
});