import { PackagePlus, Pencil, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { NewProduct, Product } from '../../types'
import { buttonStyles, Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { FormRow, InsetForm } from '../../components/ui/FormParts'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { CountBadge } from '../../components/ui/EmptyState'
import { Notice, SectionHeading } from '../../components/ui/Notice'
import { IconButton, TextButton } from '../../components/ui/IconButton'

interface ProductsPanelProps {
  canManage: boolean
  products: Product[]
  onRefresh: () => Promise<void>
}

const emptyForm: NewProduct = { name: '', price: 0, stockQuantity: 0 }

export function ProductsPanel({ canManage, products, onRefresh }: ProductsPanelProps) {
  const [form, setForm] = useState<NewProduct>(emptyForm)
  const [editing, setEditing] = useState<Product | null>(null)
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [stockQuantity, setStockQuantity] = useState(1)
  const [saleQuantities, setSaleQuantities] = useState<Record<string, number>>({})
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setForm(emptyForm)
  }

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (editing) {
        await repository.updateProduct(editing.id, { name: form.name, price: form.price, active: editing.active })
        setMessage('Produto atualizado.')
      } else {
        await repository.createProduct(form)
        setMessage('Produto adicionado ao catálogo.')
      }
      resetForm()
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar o produto'))
    } finally {
      setBusy(false)
    }
  }

  const sellProduct = async (product: Product) => {
    setBusy(true)
    setMessage(null)
    try {
      const quantity = saleQuantities[product.id] ?? 1
      await repository.sellProduct(product.id, { quantity })
      setSaleQuantities({ ...saleQuantities, [product.id]: 1 })
      setMessage(`Venda de ${product.name} registrada.`)
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível registrar a venda'))
    } finally {
      setBusy(false)
    }
  }

  const addStock = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!stockTarget) return
    setBusy(true)
    setMessage(null)
    try {
      await repository.addProductStock(stockTarget.id, stockQuantity)
      setStockTarget(null)
      setStockQuantity(1)
      setMessage('Entrada de estoque registrada.')
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível atualizar o estoque'))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (product: Product) => {
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateProduct(product.id, { active: !product.active })
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível alterar o produto'))
    } finally {
      setBusy(false)
    }
  }

  const deleteProduct = async () => {
    if (!productToDelete) return
    setBusy(true)
    setDeleteError(null)
    try {
      await repository.deleteProduct(productToDelete.id)
      setProductToDelete(null)
      await onRefresh()
    } catch (error) {
      setDeleteError(errorMessage(error, 'Não foi possível excluir o produto'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className={cardStyles} aria-labelledby="products-title">
        <SectionHeading eyebrow="Revenda" title="Produtos" id="products-title" aside={<CountBadge>{products.length}</CountBadge>} className="mb-5" />
        {message && <Notice role="status">{message}</Notice>}
        <div className="grid gap-3">
          {products.length === 0 && <p className="text-sm text-muted">{canManage ? 'Nenhum produto cadastrado. Use o formulário abaixo para adicionar o primeiro.' : 'Nenhum produto disponível. Peça ao responsável para cadastrar o estoque.'}</p>}
          {products.map((product) => {
            const stockLevel = product.stockQuantity === 0 ? 'empty' : product.stockQuantity <= 3 ? 'low' : 'ok'
            return (
              <article className={cn('grid gap-2.5 rounded-xl border bg-field p-3.5', stockLevel === 'ok' ? 'border-line' : 'border-brand')} key={product.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid gap-0.5"><strong>{product.name}</strong><span className="text-xs text-muted">{formatCurrency(product.price)}</span></div>
                  <StatusBadge status={product.active ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <p className="text-xs text-muted"><strong className="text-base text-ink">{product.stockQuantity}</strong> em estoque</p>
                <div className="flex items-center gap-2">
                  <label>
                    <span className="sr-only">Quantidade de {product.name}</span>
                    <Input
                      className="min-h-10 w-16 px-2 py-1.5 text-sm"
                      aria-label={`Quantidade de ${product.name}`}
                      disabled={busy || !product.active || product.stockQuantity === 0}
                      min="1"
                      step="1"
                      type="number"
                      value={saleQuantities[product.id] ?? 1}
                      onChange={(event) => setSaleQuantities({ ...saleQuantities, [product.id]: Number(event.target.value) })}
                    />
                  </label>
                  <button className={buttonStyles({ variant: 'primary', size: 'sm' })} disabled={busy || !product.active || product.stockQuantity === 0} onClick={() => sellProduct(product)}>
                    <ShoppingCart aria-hidden="true" /> Vender
                  </button>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <TextButton disabled={busy} onClick={() => {
                      setEditing(product)
                      setForm({ name: product.name, price: product.price, stockQuantity: product.stockQuantity })
                    }}><Pencil aria-hidden="true" /> Editar</TextButton>
                    <TextButton disabled={busy} onClick={() => setStockTarget(product)}><PackagePlus aria-hidden="true" /> Entrada</TextButton>
                    <TextButton disabled={busy} onClick={() => toggleActive(product)}>{product.active ? 'Desativar' : 'Ativar'}</TextButton>
                    <TextButton tone="danger" disabled={busy} onClick={() => {
                      setDeleteError(null)
                      setProductToDelete(product)
                    }}><Trash2 aria-hidden="true" /> Excluir</TextButton>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {canManage && stockTarget && (
          <form className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-surface-3 p-3" onSubmit={addStock}>
            <label className="flex items-center gap-2 text-xs font-extrabold">Entrada para {stockTarget.name}<Input className="min-h-10 w-20 px-2 py-1.5 text-sm" type="number" min="1" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(Number(event.target.value))} required /></label>
            <button className={buttonStyles({ variant: 'primary', size: 'sm' })} disabled={busy}><PackagePlus aria-hidden="true" /> Somar</button>
            <IconButton tone="subtle" type="button" onClick={() => setStockTarget(null)} aria-label="Cancelar entrada"><X aria-hidden="true" /></IconButton>
          </form>
        )}

        {canManage && (
          <InsetForm title={editing ? 'Editar produto' : 'Novo produto'} icon={<Plus aria-hidden="true" />} onSubmit={saveProduct}>
            <Field label="Nome"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={3} maxLength={80} /></Field>
            <FormRow>
              <Field label="Preço (R$)"><Input type="number" min="0.01" max="10000" step="0.01" value={form.price || ''} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} required /></Field>
              {!editing && <Field label="Estoque inicial"><Input type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} required /></Field>}
            </FormRow>
            <Button type="submit" variant="dark" block loading={busy}><Plus aria-hidden="true" /> {editing ? 'Salvar alterações' : 'Adicionar produto'}</Button>
            {editing && <Button variant="ghost" block onClick={resetForm}>Cancelar edição</Button>}
          </InsetForm>
        )}
      </section>
      {productToDelete && (
        <ConfirmDialog
          eyebrow="Confirmar exclusão"
          title={`Excluir ${productToDelete.name}?`}
          description="Produtos com vendas registradas não podem ser excluídos. Nesse caso, desative o produto para preservar o histórico."
          cancelLabel="Manter produto"
          confirmLabel={busy ? 'Excluindo…' : 'Sim, excluir'}
          busy={busy}
          error={deleteError}
          onCancel={() => {
            setDeleteError(null)
            setProductToDelete(null)
          }}
          onConfirm={deleteProduct}
        />
      )}
    </>
  )
}
