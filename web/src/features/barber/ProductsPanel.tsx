import { PackagePlus, Pencil, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { NewProduct, Product } from '../../types'

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
      <section className="panel products-panel" aria-labelledby="products-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">Revenda</p><h2 id="products-title">Produtos</h2></div>
          <span className="count-badge">{products.length}</span>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="product-list">
          {products.length === 0 && <p className="empty-copy">{canManage ? 'Nenhum produto cadastrado. Use o formulário abaixo para adicionar o primeiro.' : 'Nenhum produto disponível. Peça ao responsável para cadastrar o estoque.'}</p>}
          {products.map((product) => {
            const stockLevel = product.stockQuantity === 0 ? 'empty' : product.stockQuantity <= 3 ? 'low' : 'ok'
            return (
              <article className={`product-row product-stock-${stockLevel}`} key={product.id}>
                <div className="product-heading">
                  <div><strong>{product.name}</strong><span>{formatCurrency(product.price)}</span></div>
                  <StatusBadge status={product.active ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <p className="stock-copy"><strong>{product.stockQuantity}</strong> em estoque</p>
                <div className="sale-row">
                  <label>
                    <span className="sr-only">Quantidade de {product.name}</span>
                    <input
                      aria-label={`Quantidade de ${product.name}`}
                      disabled={busy || !product.active || product.stockQuantity === 0}
                      min="1"
                      step="1"
                      type="number"
                      value={saleQuantities[product.id] ?? 1}
                      onChange={(event) => setSaleQuantities({ ...saleQuantities, [product.id]: Number(event.target.value) })}
                    />
                  </label>
                  <button className="button button-small button-primary" disabled={busy || !product.active || product.stockQuantity === 0} onClick={() => sellProduct(product)}>
                    <ShoppingCart aria-hidden="true" /> Vender
                  </button>
                </div>
                {canManage && (
                  <div className="product-actions">
                    <button className="text-button" disabled={busy} onClick={() => {
                      setEditing(product)
                      setForm({ name: product.name, price: product.price, stockQuantity: product.stockQuantity })
                    }}><Pencil aria-hidden="true" /> Editar</button>
                    <button className="text-button" disabled={busy} onClick={() => setStockTarget(product)}><PackagePlus aria-hidden="true" /> Entrada</button>
                    <button className="text-button" disabled={busy} onClick={() => toggleActive(product)}>{product.active ? 'Desativar' : 'Ativar'}</button>
                    <button className="text-button danger" disabled={busy} onClick={() => {
                      setDeleteError(null)
                      setProductToDelete(product)
                    }}><Trash2 aria-hidden="true" /> Excluir</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {canManage && stockTarget && (
          <form className="stock-form" onSubmit={addStock}>
            <label>Entrada para {stockTarget.name}<input type="number" min="1" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(Number(event.target.value))} required /></label>
            <button className="button button-small button-primary" disabled={busy}><PackagePlus aria-hidden="true" /> Somar</button>
            <button className="icon-button subtle" type="button" onClick={() => setStockTarget(null)} aria-label="Cancelar entrada"><X aria-hidden="true" /></button>
          </form>
        )}

        {canManage && (
          <form className="service-form product-form" onSubmit={saveProduct}>
            <h3><Plus aria-hidden="true" /> {editing ? 'Editar produto' : 'Novo produto'}</h3>
            <label>Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={3} maxLength={80} /></label>
            <div className="form-row">
              <label>Preço (R$)<input type="number" min="0.01" max="10000" step="0.01" value={form.price || ''} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} required /></label>
              {!editing && <label>Estoque inicial<input type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} required /></label>}
            </div>
            <button className="button button-dark button-wide" disabled={busy}><Plus aria-hidden="true" /> {editing ? 'Salvar alterações' : 'Adicionar produto'}</button>
            {editing && <button className="button button-ghost button-wide" type="button" onClick={resetForm}>Cancelar edição</button>}
          </form>
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
