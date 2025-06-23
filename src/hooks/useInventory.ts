'use client';
import { useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { InventoryItem } from '@/types/inventory';
import { db } from '@/lib/firebaseClient';

/* ---- collection reference ------------------------------------ */
const coll = collection(db, 'inventory');

/* ---- hook ----------------------------------------------------- */
export function useInventory() {
  const qc = useQueryClient();

  /* ---------- read query (con cache infinita) ------------------ */
  const {
    data: inventory = [],
    isPending: loading,
  } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: async () => {
      const snap = await getDocs(coll);
      return snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }),
      );
    },
    initialData: [],
    staleTime: Infinity,
  });

  /* ---------- realtime listener que empuja cambios -------------- */
  useEffect(() => {
    const unsub = onSnapshot(coll, (snap) => {
      qc.setQueryData<InventoryItem[]>(
        ['inventory'],
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }),
        ),
      );
    });
    return unsub;
  }, [qc]);

  /*  util para cancelar y guardar snapshot antes de la mutación  */
  const cancelAndSnapshot = async () => {
    await qc.cancelQueries({ queryKey: ['inventory'] });
    const prev = qc.getQueryData<InventoryItem[]>(['inventory']) ?? [];
    return { prev };
  };

  /* ---------- ADD ---------------------------------------------- */
  const addMutation = useMutation<
    InventoryItem,                          // retorno
    unknown,                                // error
    Omit<InventoryItem, 'id'>,              // variables
    { prev: InventoryItem[] }               // context
  >({
    mutationFn: async (item) => {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as InventoryItem;   // { id, ...item }
    },
    onMutate: async (item) => {
      const ctx = await cancelAndSnapshot();
      const optimistic = { id: crypto.randomUUID(), ...item };
      qc.setQueryData<InventoryItem[]>(['inventory'], (list) => [
        ...(list ?? []),
        optimistic,
      ]);
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['inventory'], ctx?.prev);
    },
  });

  /* ---------- EDIT --------------------------------------------- */
  const editMutation = useMutation<
    void,
    unknown,
    { id: string } & Partial<InventoryItem>,
    { prev: InventoryItem[] }
  >({
    mutationFn: async ({ id, ...patch }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: async ({ id, ...patch }) => {
      const ctx = await cancelAndSnapshot();
      qc.setQueryData<InventoryItem[]>(['inventory'], (list) =>
        (list ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['inventory'], ctx?.prev);
    },
  });

  /* ---------- DELETE ------------------------------------------- */
  const removeMutation = useMutation<
    void,
    unknown,
    string,
    { prev: InventoryItem[] }
  >({
    mutationFn: async (id) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: async (id) => {
      const ctx = await cancelAndSnapshot();
      qc.setQueryData<InventoryItem[]>(['inventory'], (list) =>
        (list ?? []).filter((i) => i.id !== id),
      );
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['inventory'], ctx?.prev);
    },
  });

  /* ---------- API que exponemos al componente ------------------- */
  return {
    inventory,
    loading,
    addItem:   addMutation.mutate,
    editItem:  editMutation.mutate,
    deleteItem: removeMutation.mutate,
  };
}
