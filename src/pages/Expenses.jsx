import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { useTranslation } from "@/i18n/I18nContext";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CATEGORIES = ["snacks", "repairs", "utilities", "rent", "salaries", "other"];
const CATEGORY_COLORS = {
  snacks: "bg-yellow-500/20 text-yellow-300", repairs: "bg-red-500/20 text-red-300",
  utilities: "bg-blue-500/20 text-blue-300", rent: "bg-purple-500/20 text-purple-300",
  salaries: "bg-green-500/20 text-green-300", other: "bg-gray-500/20 text-gray-300",
};

export default function Expenses() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: "", amount: "", category: "other", date: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    try {
      const e = await storageAdapter.entities.Expense.list("-date");
      setExpenses(e);
    } catch (error) {
      console.error("Expenses failed to load:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!form.amount || isNaN(parseFloat(form.amount))) return toast.error(t('expenses.toast.invalidAmount'));
    await storageAdapter.entities.Expense.create({ ...form, amount: parseFloat(parseFloat(form.amount).toFixed(2)) });
    toast.success(t('expenses.toast.added'));
    setForm({ description: "", amount: "", category: "other", date: new Date().toISOString().slice(0, 10) });
    load();
  };

  const remove = async (id) => {
    await storageAdapter.entities.Expense.delete(id);
    toast.success(t('expenses.toast.removed')); load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayTotal = expenses.filter((e) => e.date === today).reduce((s, e) => s + (e.amount || 0), 0);
  const monthTotal = expenses.filter((e) => e.date?.startsWith(thisMonth)).reduce((s, e) => s + (e.amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">{t('expenses.title')}</h2>
        <p className="text-game-muted text-sm mt-1">{t('expenses.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-game-surface border border-red-500/20 rounded-xl p-4">
          <p className="text-game-muted text-xs mb-1">{t('expenses.todayTotal')}</p>
          <p className="text-2xl font-bold text-red-400">${todayTotal.toFixed(2)}</p>
        </div>
        <div className="bg-game-surface border border-orange-500/20 rounded-xl p-4">
          <p className="text-game-muted text-xs mb-1">{t('expenses.monthTotal')}</p>
          <p className="text-2xl font-bold text-orange-400">${monthTotal.toFixed(2)}</p>
        </div>
      </div>

      <div data-tour="add-expense" className="bg-game-surface border border-game-border rounded-xl p-5 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" /> {t('expenses.addTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('expenses.descPlaceholder')} className="bg-game-bg border-game-border text-white" />
          </div>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t('expenses.amountPlaceholder')} className="bg-game-bg border-game-border text-white" />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-game-bg border-game-border text-white" />
          <div data-tour="category-labels">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-game-bg border-game-border text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-game-surface border-game-border">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`expenses.category.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} className="bg-blue-600 hover:bg-blue-500 text-white">{t('expenses.addButton')}</Button>
        </div>
      </div>

      <div data-tour="expense-list" className="space-y-2">
        {expenses.length === 0 && (
          <div className="text-center py-12 text-game-muted">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {t('expenses.empty')}
          </div>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="bg-game-surface border border-game-border rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS.other}`}>
                {t(`expenses.category.${e.category}`) || e.category}
              </span>
              <div>
                <p className="text-white text-sm font-medium">{e.description || e.category}</p>
                <p className="text-game-muted text-xs">{e.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-red-400 font-bold">${(e.amount || 0).toFixed(2)}</p>
              <Button onClick={() => remove(e.id)} variant="outline" size="icon" className="border-red-500/30 text-red-400 hover:bg-red-600/20 w-7 h-7">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
