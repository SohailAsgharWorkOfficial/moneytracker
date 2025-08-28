
import React, { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// --- Helpers
const BANKS = ["UBL", "JS Bank", "Meezan Bank", "ABL", "NayaPay", "Easypaisa", "JazzCash"];
const CATEGORIES = [
  "Salary", "Business", "Freelance", "Investment", "Gift", "Food", "Transport", "Bills", "Education", "Health", "Shopping", "Rent", "Misc"
];
const STORAGE_KEY = "pfm_prototype_v1";

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function fmt(num) { return Number(num || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; // YYYY-MM
}
function yearKey(d){ return String(new Date(d).getFullYear()); }

// --- Storage
function useLocalStorageState(defaultState){
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      return JSON.parse(raw);
    } catch {
      return defaultState;
    }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  return [state, setState];
}

// --- Main App
export default function App(){
  const [db, setDb] = useLocalStorageState({
    transactions: [], // {id,date,type:'income'|'expense',description,amount,bank,category}
    loansTaken: [],  // {id, person, amount, startDate, dueDate, installments, schedule:[{id,dueDate,amount,paid:false,paidDate:null}], notes:''}
    loansGiven: [],  // same shape
  });
  const [tab, setTab] = useState("dashboard");

  // --- Derived
  const bankSummaries = useMemo(() => {
    const sums = Object.fromEntries(BANKS.map(b => [b, 0]));
    for(const t of db.transactions){
      if(!(t.bank in sums)) continue;
      sums[t.bank] += (t.type === 'income' ? 1 : -1) * Number(t.amount);
    }
    return sums;
  }, [db.transactions]);

  const dailyTotals = useMemo(() => {
    // Map date -> {income, expense}
    const map = new Map();
    for(const t of db.transactions){
      const key = t.date;
      if(!map.has(key)) map.set(key, { income:0, expense:0 });
      map.get(key)[t.type] += Number(t.amount);
    }
    // sort by date
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, income: v.income, expense: v.expense, net: v.income - v.expense }));
  }, [db.transactions]);

  const monthlySavings = useMemo(() => {
    const map = new Map(); // YYYY-MM -> {income, expense}
    for(const t of db.transactions){
      const k = monthKey(t.date);
      if(!map.has(k)) map.set(k, { income:0, expense:0 });
      map.get(k)[t.type] += Number(t.amount);
    }
    return Array.from(map.entries()).sort().map(([m, v])=>({ month:m, income:v.income, expense:v.expense, saving: v.income - v.expense }));
  }, [db.transactions]);

  const yearlySavings = useMemo(() => {
    const map = new Map(); // YYYY -> {income, expense}
    for(const t of db.transactions){
      const k = yearKey(t.date);
      if(!map.has(k)) map.set(k, { income:0, expense:0 });
      map.get(k)[t.type] += Number(t.amount);
    }
    return Array.from(map.entries()).sort().map(([y, v])=>({ year:y, income:v.income, expense:v.expense, saving: v.income - v.expense }));
  }, [db.transactions]);

  const totals = useMemo(()=>{
    let income=0, expense=0;
    for(const t of db.transactions){
      if(t.type==='income') income += Number(t.amount); else expense += Number(t.amount);
    }
    return { income, expense, net: income - expense };
  }, [db.transactions]);

  // --- Actions
  function addTransaction(tx){
    setDb(prev => ({...prev, transactions: [{...tx, id: uid()}, ...prev.transactions]}));
  }
  function deleteTransaction(id){
    setDb(prev => ({...prev, transactions: prev.transactions.filter(t=>t.id!==id)}));
  }

  function generateInstallments(amount, startDate, count){
    const amt = Number(amount);
    const per = Math.round((amt / count) * 100) / 100;
    const list = [];
    const start = new Date(startDate);
    for(let i=0;i<count;i++){
      const d = new Date(start);
      d.setMonth(d.getMonth()+i+1); // first installment next month
      list.push({ id: uid(), dueDate: d.toISOString().slice(0,10), amount: per, paid:false, paidDate:null });
    }
    // adjust last installment to match exact total
    const sum = list.reduce((s,x)=>s+x.amount,0);
    const diff = Math.round((amt - sum) * 100) / 100;
    list[list.length-1].amount = Math.round((list[list.length-1].amount + diff) * 100)/100;
    return list;
  }

  function addLoan(kind, payload){
    setDb(prev => ({
      ...prev,
      [kind]: [{ id: uid(), ...payload }, ...prev[kind]]
    }));
  }
  function toggleInstallment(kind, loanId, instId){
    setDb(prev => ({
      ...prev,
      [kind]: prev[kind].map(l => l.id!==loanId ? l : {
        ...l,
        schedule: l.schedule.map(s => s.id!==instId ? s : ({...s, paid: !s.paid, paidDate: !s.paid ? todayISO() : null}))
      })
    }));
  }
  function deleteLoan(kind, loanId){
    setDb(prev => ({...prev, [kind]: prev[kind].filter(l=>l.id!==loanId)}));
  }

  function clearAll(){
    if(confirm("Are you sure? This will delete all data.")){
      setDb({ transactions: [], loansTaken: [], loansGiven: [] });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <h1 className="text-2xl font-bold">Personal Finance & Loans (Prototype)</h1>
          <span className="ml-auto"></span>
          <button onClick={()=>setTab("dashboard")} className={tabBtn(tab,"dashboard")}>Dashboard</button>
          <button onClick={()=>setTab("transactions")} className={tabBtn(tab,"transactions")}>Transactions</button>
          <button onClick={()=>setTab("banks")} className={tabBtn(tab,"banks")}>Banks</button>
          <button onClick={()=>setTab("loans")} className={tabBtn(tab,"loans")}>Loans</button>
          <button onClick={()=>setTab("reports")} className={tabBtn(tab,"reports")}>Reports</button>
          <button onClick={clearAll} className="ml-2 px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm">Reset</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab==="dashboard" && <Dashboard totals={totals} bankSummaries={bankSummaries} monthly={monthlySavings} daily={dailyTotals} />}
        {tab==="transactions" && <Transactions onAdd={addTransaction} list={db.transactions} onDelete={deleteTransaction} />}
        {tab==="banks" && <BanksView transactions={db.transactions} bankSummaries={bankSummaries} />}
        {tab==="loans" && <LoansView db={db} addLoan={addLoan} toggleInstallment={toggleInstallment} deleteLoan={deleteLoan} />}
        {tab==="reports" && <Reports monthly={monthlySavings} yearly={yearlySavings} bankSummaries={bankSummaries} />}
      </main>
    </div>
  );
}

function tabBtn(active, me){
  return `px-3 py-1.5 rounded-xl text-sm ${active===me?"bg-slate-900 text-white":"bg-slate-100 hover:bg-slate-200"}`;
}

// --- Components
function StatCard({label, value, sub}){
  return (
    <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function Dashboard({ totals, bankSummaries, monthly, daily }){
  const bankData = Object.entries(bankSummaries).map(([bank, balance])=>({ bank, balance }));
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Income" value={`Rs ${fmt(totals.income)}`} />
        <StatCard label="Total Expenses" value={`Rs ${fmt(totals.expense)}`} />
        <StatCard label="Net Savings" value={`Rs ${fmt(totals.net)}`} sub={totals.net>=0?"Positive":"Negative"} />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
          <h3 className="font-semibold mb-3">Daily Income vs Expense</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="income" type="monotone" />
                <Line dataKey="expense" type="monotone" />
                <Line dataKey="net" type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
          <h3 className="font-semibold mb-3">Bank-wise Balances</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bankData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bank" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="balance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
        <h3 className="font-semibold mb-3">Monthly Savings</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="income" type="monotone" />
              <Line dataKey="expense" type="monotone" />
              <Line dataKey="saving" type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Transactions({ onAdd, list, onDelete }){
  const [form, setForm] = useState({ date: todayISO(), type:'expense', description:'', amount:'', bank:BANKS[0], category:'Misc' });
  function submit(e){
    e.preventDefault();
    if(!form.amount || !form.date) return alert('Please enter amount and date');
    onAdd({ ...form, amount: Number(form.amount) });
    setForm(f => ({ ...f, description:'', amount:'' }));
  }
  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-7 gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
        <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100" />
        <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" className="px-3 py-2 rounded-xl bg-slate-100" />
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100">
          {CATEGORIES.map(c=> <option key={c}>{c}</option>)}
        </select>
        <select value={form.bank} onChange={e=>setForm({...form,bank:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100">
          {BANKS.map(b=> <option key={b}>{b}</option>)}
        </select>
        <input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount" className="px-3 py-2 rounded-xl bg-slate-100" />
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white">Add</button>
      </form>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>Date</Th><Th>Type</Th><Th>Description</Th><Th>Category</Th><Th>Bank</Th><Th className="text-right">Amount</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {list.length===0 && <tr><td colSpan={7} className="text-center py-8 text-slate-500">No transactions yet</td></tr>}
            {list.map(t => (
              <tr key={t.id} className="border-t">
                <Td>{t.date}</Td>
                <Td className={t.type==='income'?"text-emerald-700":"text-rose-700"}>{t.type}</Td>
                <Td>{t.description}</Td>
                <Td>{t.category}</Td>
                <Td>{t.bank}</Td>
                <Td className="text-right font-medium">{t.type==='income'?'+':'-'} Rs {fmt(t.amount)}</Td>
                <Td>
                  <button onClick={()=>onDelete(t.id)} className="px-2 py-1 text-xs rounded-lg bg-rose-100 text-rose-700">Delete</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BanksView({ transactions, bankSummaries }){
  const [activeBank, setActiveBank] = useState(BANKS[0]);
  const bankTx = useMemo(()=> transactions.filter(t=>t.bank===activeBank).slice().reverse(), [transactions, activeBank]);
  const running = useMemo(()=>{
    let bal = 0;
    const rows = bankTx.slice().reverse().map(t => {
      bal += (t.type==='income'?1:-1) * Number(t.amount);
      return { ...t, running: bal };
    });
    return rows.reverse();
  }, [bankTx]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {BANKS.map(b => (
          <button key={b} onClick={()=>setActiveBank(b)} className={`px-3 py-1.5 rounded-xl text-sm ${activeBank===b?"bg-slate-900 text-white":"bg-slate-100"}`}>
            {b} <span className="ml-2 text-xs opacity-70">Rs {fmt(bankSummaries[b]||0)}</span>
          </button>
        ))}
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>Date</Th><Th>Type</Th><Th>Description</Th><Th className="text-right">Amount</Th><Th className="text-right">Running Balance</Th>
            </tr>
          </thead>
          <tbody>
            {running.length===0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">No transactions for {activeBank}</td></tr>}
            {running.map(t => (
              <tr key={t.id} className="border-t">
                <Td>{t.date}</Td>
                <Td className={t.type==='income'?"text-emerald-700":"text-rose-700"}>{t.type}</Td>
                <Td>{t.description}</Td>
                <Td className="text-right">Rs {fmt(t.amount)}</Td>
                <Td className="text-right font-medium">Rs {fmt(t.running)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoansView({ db, addLoan, toggleInstallment, deleteLoan }){
  const [kind, setKind] = useState('loansTaken');
  const [form, setForm] = useState({ person:'', amount:'', startDate: todayISO(), dueDate:'', installments: 0, notes:'' });

  function createLoan(e){
    e.preventDefault();
    if(!form.person || !form.amount) return alert('Enter person & amount');
    const payload = {
      person: form.person,
      amount: Number(form.amount),
      startDate: form.startDate,
      dueDate: form.dueDate || null,
      installments: Number(form.installments)||0,
      notes: form.notes,
      schedule: Number(form.installments) > 0 ? generateSchedule(Number(form.amount), form.startDate, Number(form.installments)) : [],
    };
    addLoan(kind, payload);
    setForm({ person:'', amount:'', startDate: todayISO(), dueDate:'', installments: 0, notes:'' });
  }

  function generateSchedule(amount, start, count){
    const amt = Number(amount);
    const per = Math.round((amt / count) * 100) / 100;
    const list = [];
    const s = new Date(start);
    for(let i=0;i<count;i++){
      const d = new Date(s);
      d.setMonth(d.getMonth()+i+1);
      list.push({ id: uid(), dueDate: d.toISOString().slice(0,10), amount: per, paid:false, paidDate:null });
    }
    // fix rounding
    const sum = list.reduce((s,x)=>s+x.amount,0);
    list[list.length-1].amount = Math.round((list[list.length-1].amount + (amt - sum)) * 100)/100;
    return list;
  }

  const loans = db[kind];

  return (
    <div className="grid gap-6">
      <div className="flex gap-2">
        <button onClick={()=>setKind('loansTaken')} className={`px-3 py-1.5 rounded-xl text-sm ${kind==='loansTaken'?"bg-slate-900 text-white":"bg-slate-100"}`}>Loan Taken</button>
        <button onClick={()=>setKind('loansGiven')} className={`px-3 py-1.5 rounded-xl text-sm ${kind==='loansGiven'?"bg-slate-900 text-white":"bg-slate-100"}`}>Loan Given</button>
      </div>

  

      <form onSubmit={createLoan} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
        <input value={form.person} onChange={e=>setForm({...form,person:e.target.value})} placeholder="Person/Party" className="px-3 py-2 rounded-xl bg-slate-100" />
        <input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount" className="px-3 py-2 rounded-xl bg-slate-100" />
        <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100" />
        <input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="px-3 py-2 rounded-xl bg-slate-100" />
        <input type="number" min="0" value={form.installments} onChange={e=>setForm({...form,installments:e.target.value})} placeholder="# Installments (0 for none)" className="px-3 py-2 rounded-xl bg-slate-100" />
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white">Add Loan</button>
        <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes" className="md:col-span-6 px-3 py-2 rounded-xl bg-slate-100" />
      </form>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>Person</Th><Th>Start</Th><Th>Due</Th><Th className="text-right">Amount</Th><Th className="text-center">Installments</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loans.length===0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No loans</td></tr>}
            {loans.map(l => {
              const paid = l.schedule.filter(s=>s.paid).length;
              return (
                <React.Fragment key={l.id}>
                  <tr className="border-t">
                    <Td className="font-medium">{l.person}</Td>
                    <Td>{l.startDate}</Td>
                    <Td>{l.dueDate || '-'}</Td>
                    <Td className="text-right">Rs {fmt(l.amount)}</Td>
                    <Td className="text-center">{l.schedule.length>0?`${paid}/${l.schedule.length}`:"—"}</Td>
                    <Td className="text-right"><button onClick={()=>deleteLoan(kind,l.id)} className="px-2 py-1 text-xs rounded-lg bg-rose-100 text-rose-700">Delete</button></Td>
                  </tr>
                  {l.schedule.length>0 && (
                    <tr className="border-t bg-slate-50/60">
                      <td colSpan={6}>
                        <div className="px-3 py-3">
                          <div className="font-medium mb-2">Installment Schedule</div>
                          <div className="overflow-auto">
                            <table className="min-w-[600px] text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <Th>#</Th><Th>Due Date</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Paid Date</Th><Th></Th>
                                </tr>
                              </thead>
                              <tbody>
                                {l.schedule.map((s,idx)=> (
                                  <tr key={s.id} className="border-t">
                                    <Td>{idx+1}</Td>
                                    <Td>{s.dueDate}</Td>
                                    <Td className="text-right">Rs {fmt(s.amount)}</Td>
                                    <Td>{s.paid?"PAID":"DUE"}</Td>
                                    <Td>{s.paidDate || '-'}</Td>
                                    <Td className="text-right"><button onClick={()=>toggleInstallment(kind,l.id,s.id)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs">Toggle Paid</button></Td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reports({ monthly, yearly, bankSummaries }){
  const bankArray = Object.entries(bankSummaries).map(([bank, balance])=>({ bank, balance }));
  return (
    <div className="grid gap-6">
      <section className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold mb-3">Monthly Report</h3>
        <div className="overflow-auto">
          <table className="min-w-[600px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Month</Th><Th className="text-right">Income</Th><Th className="text-right">Expense</Th><Th className="text-right">Saving</Th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(r => (
                <tr key={r.month} className="border-t">
                  <Td>{r.month}</Td>
                  <Td className="text-right">Rs {fmt(r.income)}</Td>
                  <Td className="text-right">Rs {fmt(r.expense)}</Td>
                  <Td className={`text-right ${r.saving>=0?"text-emerald-700":"text-rose-700"}`}>Rs {fmt(r.saving)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold mb-3">Yearly Report</h3>
        <div className="overflow-auto">
          <table className="min-w-[600px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Year</Th><Th className="text-right">Income</Th><Th className="text-right">Expense</Th><Th className="text-right">Saving</Th>
              </tr>
            </thead>
            <tbody>
              {yearly.map(r => (
                <tr key={r.year} className="border-t">
                  <Td>{r.year}</Td>
                  <Td className="text-right">Rs {fmt(r.income)}</Td>
                  <Td className="text-right">Rs {fmt(r.expense)}</Td>
                  <Td className={`text-right ${r.saving>=0?"text-emerald-700":"text-rose-700"}`}>Rs {fmt(r.saving)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold mb-3">Bank-wise Balances Snapshot</h3>
        <div className="overflow-auto">
          <table className="min-w-[600px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Bank/Wallet</Th><Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {bankArray.map(r => (
                <tr key={r.bank} className="border-t">
                  <Td>{r.bank}</Td>
                  <Td className="text-right">Rs {fmt(r.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Table helpers
function Th({ children, className="" }){ return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>; }
function Td({ children, className="" }){ return <td className={`px-3 py-2 ${className}`}>{children}</td>; }
