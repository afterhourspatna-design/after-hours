import fs from 'fs';

let content = fs.readFileSync('components/snacks/SnacksDashboard.tsx', 'utf-8');

// 1. Update interfaces
content = content.replace(
  `interface SnackOrder {
  id: string;`,
  `interface SnackOrderItem {
  id: string;
  amount: string;
  notes: string | null;
  addedBy: { name: string } | null;
  createdAt: string;
}

interface SnackOrder {
  id: string;
  items?: SnackOrderItem[];`
);

// 2. Add history modal states
content = content.replace(
  `const [deleting, setDeleting] = useState(false);`,
  `const [deleting, setDeleting] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyOrder, setHistoryOrder] = useState<SnackOrder | null>(null);`
);

// 3. Add notes state
content = content.replace(
  `const [snackAmountInput, setSnackAmountInput] = useState("");`,
  `const [snackAmountInput, setSnackAmountInput] = useState("");
  const [snackNotesInput, setSnackNotesInput] = useState("");`
);

// 4. Update handleOpenModal
content = content.replace(
  `setSnackAmountInput(snack.amount.toString());`,
  `setSnackAmountInput("");
      setSnackNotesInput("");`
);
content = content.replace(
  `setSnackAmountInput("");
      setSnackGuestMode(false);`,
  `setSnackAmountInput("");
      setSnackNotesInput("");
      setSnackGuestMode(false);`
);

// 5. Update handleSave
content = content.replace(
  `const payload: any = { amount: Number(snackAmountInput) };`,
  `const payload: any = { amount: Number(snackAmountInput), notes: snackNotesInput };`
);
content = content.replace(
  `const url = editingId ? \`/api/snacks/\${editingId}\` : "/api/snacks";`,
  `const url = editingId ? \`/api/snacks/\${editingId}/items\` : "/api/snacks";`
);

// 6. Delete item function
content = content.replace(
  `const handleDelete = (id: string) => {`,
  `const handleDeleteItem = async (orderId: string, itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(\`/api/snacks/\${orderId}/items/\${itemId}\`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Item deleted");
        fetchSnacks();
        // Update history modal data if open
        const updatedOrder = await res.json();
        setHistoryOrder(updatedOrder);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete item");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleDelete = (id: string) => {`
);

// 7. Update table buttons
content = content.replace(
  `<div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(snack)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>`,
  `<div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setHistoryOrder(snack);
                              setShowHistoryModal(true);
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 rounded-lg transition-colors"
                            title="History"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenModal(snack)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Add Amount"
                          >
                            <Coins className="w-4 h-4" />
                          </button>`
);

// 8. Add Notes input to Modal
content = content.replace(
  `<label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-1">Snacks Amount (₹) *</label>`,
  `<label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-1">Additional Amount (₹) *</label>`
);

content = content.replace(
  `<div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex gap-3 text-blue-400 mt-2">`,
  `<div>
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-1">Notes / Items (optional)</label>
              <input
                type="text"
                value={snackNotesInput}
                onChange={(e) => setSnackNotesInput(e.target.value)}
                disabled={submitting}
                placeholder="e.g. 2 Cokes, 1 Chips"
                className="input-field"
              />
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex gap-3 text-blue-400 mt-2">`
);

content = content.replace(
  `<h3 className="text-lg font-bold text-white">{editingId ? "Edit Snack Order" : "Record Snack Sale"}</h3>`,
  `<h3 className="text-lg font-bold text-white">{editingId ? "Add to Open Tab" : "Record Snack Sale"}</h3>`
);

content = content.replace(
  `{/* Customer Toggle */}`,
  `{editingId && (
              <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 mb-2">
                <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Adding to Tab For</p>
                <p className="text-sm text-white font-medium">{snackGuestMode ? snackGuestName || "Guest" : snackSelectedUser?.name}</p>
                <p className="text-xs text-zinc-400">{snackGuestMode ? snackGuestPhone : snackSelectedUser?.phone}</p>
              </div>
            )}
            
            {/* Customer Toggle */}`
);

// Hide customer selection if editing
content = content.replace(
  `<div className="space-y-2">`,
  `<div className={cn("space-y-2", editingId && "hidden")}>`
);

// 9. Append History Modal at the end
const historyModal = `
      {/* History Modal */}
      {showHistoryModal && historyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setShowHistoryModal(false)}
          />

          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl z-10 p-6 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-4 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  Order History
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Tab for: <span className="text-white font-medium">{historyOrder.user?.name ?? historyOrder.guestName ?? "Guest"}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Total Amount</p>
                  <p className="text-xl font-bold text-emerald-400">{formatCurrency(Number(historyOrder.amount))}</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto custom-scroll pr-2 space-y-3">
              {historyOrder.items && historyOrder.items.length > 0 ? (
                historyOrder.items.map((item, idx) => (
                  <div key={item.id} className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 flex items-center justify-between group">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                        {historyOrder.items!.length - idx}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white mb-0.5">{item.notes || "Added items"}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{formatDate(item.createdAt)}</span>
                          {item.addedBy && (
                            <>
                              <span>•</span>
                              <span>Added by {item.addedBy.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(Number(item.amount))}</p>
                      {historyOrder.paymentStatus === "UNPAID" && (
                        <button
                          onClick={() => handleDeleteItem(historyOrder.id, item.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete line item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-500 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No item history available for this order.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(
  `{/* Delete Confirmation Modal */}`,
  historyModal + `\n\n      {/* Delete Confirmation Modal */}`
);

fs.writeFileSync('scratch/SnacksDashboard.tsx', content);
console.log('Modified scratch file successfully.');
