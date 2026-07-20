import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Dish, RecipeItem } from '@/types/database'

export interface RecipeItemRow extends RecipeItem {
  product: { id: string; canonical_name: string } | null
}

export interface DishWithRecipe extends Dish {
  items: RecipeItemRow[]
}

export interface RecipeItemInput {
  product_id: string
  quantity: number
  unit: string | null
}

export interface DishInput {
  name: string
  category: string | null
  menu_price: number | null
  items: RecipeItemInput[]
}

const KEY = ['dishes']

export function useDishes() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<DishWithRecipe[]> => {
      const { data, error } = await supabase
        .from('dishes')
        .select('*, items:recipe_items(*, product:products(id, canonical_name))')
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as DishWithRecipe[]
    },
  })
}

async function replaceRecipe(dishId: string, items: RecipeItemInput[]) {
  const { error: delErr } = await supabase
    .from('recipe_items')
    .delete()
    .eq('dish_id', dishId)
  if (delErr) throw delErr
  const rows = items
    .filter((it) => it.product_id && it.quantity > 0)
    .map((it) => ({ ...it, dish_id: dishId }))
  if (rows.length > 0) {
    const { error } = await supabase.from('recipe_items').insert(rows as never)
    if (error) throw error
  }
}

export function useSaveDish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: DishInput }) => {
      const { items, ...fields } = input
      let dishId = id
      if (dishId) {
        const { error } = await supabase.from('dishes').update(fields as never).eq('id', dishId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('dishes')
          .insert(fields as never)
          .select()
          .single()
        if (error) throw error
        dishId = (data as { id: string }).id
      }
      await replaceRecipe(dishId!, items)
      return { id: dishId! }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteDish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dishes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
