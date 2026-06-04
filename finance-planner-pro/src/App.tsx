import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { 
  LineChart, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, 
  Calendar, CreditCard, ShieldAlert, Percent, Calculator, 
  Sparkles, FileText, Download, CheckCircle, RefreshCw, LogIn, LogOut, 
   Moon, Sun, Menu, Plus, Trash2, Info
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInAnonymously, signInWithCustomToken,
  onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, 
  onSnapshot, addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';

// --- CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE ---
// @ts-ignore
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'finance-planner-pro-v1';
// Substitui quaisquer barras '/' para evitar criar segmentos extras nas referências de coleções do Firestore (Erro 1)
const appId = rawAppId.replace(/\//g, '_');

let db: any = null;
let auth: any = null;

try {
  // @ts-ignore
  if (typeof __firebase_config !== 'undefined') {
    // @ts-ignore
    const firebaseConfig = JSON.parse(__firebase_config);
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Erro ao inicializar Firebase. Usando fallback em memória.", e);
}


// --- DEFINE INTERFACES PARA O TYPESCRIPT COMPILAR SEM ERROS ---
interface Receita {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  recorrente: string;
  frequencia: string;
}

interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  pagamento: string;
  recorrente: string;
  frequencia: string;
}

interface Parcelamento {
  id: string;
  nome: string;
  valorTotal: number;
  parcelasQtd: number;
  parcelaAtual: number;
  valorParcela: number;
  dataVencimento: string;
}

interface Emprestimo {
  id: string;
  instituicao: string;
  valorContratado: number;
  taxaJuros: number;
  parcelasQtd: number;
  parcelaAtual: number;
  valorParcela: number;
  dataInicial: string;
}

interface Imposto {
  id: string;
  descricao: string;
  valorTotal: number;
  parcelasQtd: number;
  parcelasPagas: number;
  valorParcela: number;
  dataVencimento: string;
}

interface AnaliseResultado {
  nivel: string;
  corFundo: string;
  corTexto: string;
  taxaEndividamento: number;
  capPagamento: number;
  recomendadoReserva: number;
  sugestoes: string[];
  dataAnalise: string;
}

interface SimResultado {
  nome: string;
  valorTotal: number;
  parcelas: number;
  valorMensal: number;
  taxaAtual: number;
  taxaFutura: number;
  classificacao: string;
  cor: string;
  impactoSaldo: number;
}

// Helper seguro para renderizar ícones de alerta sem passar objetos de componentes (Erro 2)
const renderAlertaIcon = (tipo: string) => {
  switch (tipo) {
    case 'erro':
      return <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />;
    case 'aviso':
      return <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />;
    case 'info':
    default:
      return <Calendar className="w-5 h-5 shrink-0 mt-0.5 text-sky-400" />;
  }
};

export default function App() {
  // --- ESTADOS DE AUTENTICAÇÃO E CONEXÃO ---
  const [user, setUser] = useState<any | null>(null);
  const [, setAuthLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [useLocalData, setUseLocalData] = useState(false);

  // --- ESTADOS DA INTERFACE ---
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: string } | null>(null);

  // --- ESTADOS DOS DADOS FINANCEIROS ---
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [impostos, setImpostos] = useState<Imposto[]>([]);
  const [reservaMeta, setReservaMeta] = useState(15000);
  const [reservaAtual, setReservaAtual] = useState(3200);
  const [reservaMensal, setReservaMensal] = useState(400);

  // --- ESTADOS DE FORMULÁRIO ---
  // Form Receita
  const [recDesc, setRecDesc] = useState('');
  const [recCat, setRecCat] = useState('Salário');
  const [recVal, setRecVal] = useState('');
  const [recDate, setRecDate] = useState(new Date().toISOString().split('T')[0]);
  const [recRecorrente, setRecRecorrente] = useState('Nao');
  const [recFreq, setRecFreq] = useState('Mensal');

  // Form Despesa
  const [desDesc, setDesDesc] = useState('');
  const [desCat, setDesCat] = useState('Moradia');
  const [desVal, setDesVal] = useState('');
  const [desDate, setDesDate] = useState(new Date().toISOString().split('T')[0]);
  const [desPay, setDesPay] = useState('Pix');
  const [desRecorrente, setDesRecorrente] = useState('Nao');
  const [desFreq, setDesFreq] = useState('Mensal');

  // Form Parcelamento
  const [parName, setParName] = useState('');
  const [parTotalVal, setParTotalVal] = useState('');
  const [parQtd, setParQtd] = useState('');
  const [parAtual, setParAtual] = useState('1');
  const [parDate, setParDate] = useState(new Date().toISOString().split('T')[0]);

  // Form Emprestimo
  const [empInst, setEmpInst] = useState('');
  const [empVal, setEmpVal] = useState('');
  const [empJuros, setEmpJuros] = useState('');
  const [empQtd, setEmpQtd] = useState('');
  const [empParVal, setEmpParVal] = useState('');
  const [empDateStart, setEmpDateStart] = useState(new Date().toISOString().split('T')[0]);

  // Form Impostos (IRPF)
  const [impDesc, setImpDesc] = useState('IRPF 2026');
  const [impTotal, setImpTotal] = useState('');
  const [impQtd, setImpQtd] = useState('8');
  const [impPagas, setImpPagas] = useState('0');

  // --- ESTADOS DO SIMULADOR ---
  const [simType, setSimType] = useState('parcela');
  const [simName, setSimName] = useState('Simulação de Notebook');
  const [simVal, setSimVal] = useState('3500');
  const [simParc, setSimParc] = useState('10');
  const [simJuros, setSimJuros] = useState('0');
  const [simResultado, setSimResultado] = useState<SimResultado | null>(null);

  // --- ESTADOS DO DIAGNÓSTICO ---
  const [analiseResultado, setAnaliseResultado] = useState<AnaliseResultado | null>(null);
  const [isAnalisando, setIsAnalisando] = useState(false);

  // --- ESTADO DE FILTRO DE PROJEÇÃO ---
  const [projecaoMeses, setProjecaoMeses] = useState(6);

  // --- DADOS ESTÁTICOS / DEFAULT (para fallback local) ---
  const loadDefaultMockData = () => {
    setReceitas([
      { id: 'r1', descricao: 'Salário Tech Corp', categoria: 'Salário', valor: 6500, data: '2026-06-05', recorrente: 'Sim', frequencia: 'Mensal' },
      { id: 'r2', descricao: 'Freela UI Design', categoria: 'Freela', valor: 1200, data: '2026-06-15', recorrente: 'Nao', frequencia: 'Mensal' },
      { id: 'r3', descricao: 'Dividendos FIIs', categoria: 'Investimento', valor: 350, data: '2026-06-12', recorrente: 'Sim', frequencia: 'Mensal' },
    ]);
    setDespesas([
      { id: 'd1', descricao: 'Aluguel & Condomínio', categoria: 'Moradia', valor: 2200, data: '2026-06-10', pagamento: 'Boleto', recorrente: 'Sim', frequencia: 'Mensal' },
      { id: 'd2', descricao: 'Supermercado Mensal', categoria: 'Alimentação', valor: 850, data: '2026-06-03', pagamento: 'Cartão de Crédito', recorrente: 'Nao', frequencia: 'Mensal' },
      { id: 'd3', descricao: 'Combustível', categoria: 'Transporte', valor: 400, data: '2026-06-18', pagamento: 'Pix', recorrente: 'Sim', frequencia: 'Mensal' },
      { id: 'd4', descricao: 'Plano de Saúde', categoria: 'Saúde', valor: 350, data: '2026-06-15', pagamento: 'Débito', recorrente: 'Sim', frequencia: 'Mensal' },
      { id: 'd5', descricao: 'Assinatura Streaming', categoria: 'Internet', valor: 55, data: '2026-06-22', pagamento: 'Cartão de Crédito', recorrente: 'Sim', frequencia: 'Mensal' },
    ]);
    setParcelamentos([
      { id: 'p1', nome: 'Notebook Gamer', valorTotal: 4800, parcelasQtd: 12, parcelaAtual: 6, valorParcela: 400, dataVencimento: '2026-06-15' },
      { id: 'p2', nome: 'Seguro do Carro', valorTotal: 2400, parcelasQtd: 6, parcelaAtual: 3, valorParcela: 400, dataVencimento: '2026-06-20' },
    ]);
    setEmprestimos([
      { id: 'e1', instituicao: 'Banco do Brasil', valorContratado: 17097.63, parcelasQtd: 14, parcelaAtual: 5, valorParcela: 1695.19, taxaJuros: 3.68, dataInicial: '2026-02-10' },
    ]);
    setImpostos([
      { id: 'i1', descricao: 'IRPF 2026', valorTotal: 7040, parcelasQtd: 8, valorParcela: 880, parcelasPagas: 2, dataVencimento: '2026-06-30' },
    ]);
    setReservaMeta(25000);
    setReservaAtual(6500);
    setReservaMensal(500);
  };

  // --- AUTH E INICIALIZAÇÃO FIREBASE ---
  useEffect(() => {
    // Carrega dados locais imediatamente — app funcional desde o primeiro render
    loadDefaultMockData();

    if (!auth || !db) {
      setUseLocalData(true);
      setAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // @ts-ignore
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          // @ts-ignore
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        // Erro permanente (400 = auth desabilitado) — sem retry, fica no modo local
        console.error("Falha ao autenticar no Firebase. Usando modo de dados local.", err);
        setUseLocalData(true);
        setAuthLoading(false);
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUseLocalData(false);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- CARREGAMENTO DE DADOS VIA FIRESTORE (RULE 1 & 2) ---
  useEffect(() => {
    if (useLocalData || !user || !db) return;

    // Monitoramento reativo das Coleções usando as Rotas Estritas da RULE 1 (com appId Higienizado)
    // Receitas
    const qReceitas = collection(db, 'artifacts', appId, 'users', user.uid, 'receitas');
    const unsubRec = onSnapshot(qReceitas, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Receita[];
      setReceitas(data);
    }, (error) => console.error("Erro escuta receitas: ", error));

    // Despesas
    const qDespesas = collection(db, 'artifacts', appId, 'users', user.uid, 'despesas');
    const unsubDes = onSnapshot(qDespesas, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Despesa[];
      setDespesas(data);
    }, (error) => console.error("Erro escuta despesas: ", error));

    // Parcelamentos
    const qParcelamentos = collection(db, 'artifacts', appId, 'users', user.uid, 'parcelamentos');
    const unsubPar = onSnapshot(qParcelamentos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Parcelamento[];
      setParcelamentos(data);
    }, (error) => console.error("Erro escuta parcelamentos: ", error));

    // Emprestimos
    const qEmprestimos = collection(db, 'artifacts', appId, 'users', user.uid, 'emprestimos');
    const unsubEmp = onSnapshot(qEmprestimos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Emprestimo[];
      setEmprestimos(data);
    }, (error) => console.error("Erro escuta emprestimos: ", error));

    // Impostos
    const qImpostos = collection(db, 'artifacts', appId, 'users', user.uid, 'impostos');
    const unsubImp = onSnapshot(qImpostos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Imposto[];
      setImpostos(data);
    }, (error) => console.error("Erro escuta impostos: ", error));

    // Metas de Reserva (Documento de Configurações do Usuário)
    const docReserva = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'reserva');
    const unsubRes = onSnapshot(docReserva, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        setReservaMeta(d.meta || 15000);
        setReservaAtual(d.atual || 3000);
        setReservaMensal(d.mensal || 300);
      } else {
        // Inicializa com padrões no banco
        setDoc(docReserva, { meta: 20000, atual: 5000, mensal: 500 });
      }
    }, (error) => console.error("Erro escuta reserva: ", error));

    return () => {
      unsubRec();
      unsubDes();
      unsubPar();
      unsubEmp();
      unsubImp();
      unsubRes();
    };
  }, [user, useLocalData]);

  // --- ACTIONS DE LOGIN/CADASTRO COM FIREBASE AUTH ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      triggerFeedback('Por favor, preencha todos os campos.', 'error');
      return;
    }

    if (!auth) {
      triggerFeedback('Firebase não configurado. Usando sessão local.', 'error');
      return;
    }

    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        if (nameInput) {
          await updateProfile(credential.user, { displayName: nameInput });
        }
        triggerFeedback(`Conta criada com sucesso! Bem-vindo, ${nameInput || emailInput}.`);
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        triggerFeedback(`Login realizado com sucesso!`);
      }
      setActiveTab('dashboard');
    } catch (err: any) {
      const mensagens: Record<string, string> = {
        'auth/email-already-in-use':  'Este e-mail já está cadastrado. Faça login.',
        'auth/invalid-email':         'E-mail inválido.',
        'auth/weak-password':         'Senha fraca. Use ao menos 6 caracteres.',
        'auth/user-not-found':        'Usuário não encontrado.',
        'auth/wrong-password':        'Senha incorreta.',
        'auth/invalid-credential':    'E-mail ou senha incorretos.',
      };
      triggerFeedback(mensagens[err.code] || `Erro: ${err.message}`, 'error');
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setUseLocalData(true);
    loadDefaultMockData();
    triggerFeedback('Sessão encerrada.', 'success');
  };

  // --- MENSAGEM DE FEEDBACK TEMPORÁRIO ---
  const triggerFeedback = (msg: string, type = 'success') => {
    setFeedbackMsg({ text: msg, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // --- OPERAÇÕES DE BANCO DE DADOS (C.R.U.D.) COM FALLBACK LOCAL ---

  // ADICIONAR RECEITA
  const addReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recDesc || !recVal) return;
    const item = {
      descricao: recDesc,
      categoria: recCat,
      valor: parseFloat(recVal),
      data: recDate,
      recorrente: recRecorrente,
      frequencia: recFreq
    };

    if (!useLocalData && user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'receitas'), item);
        triggerFeedback('Receita adicionada com sucesso!');
      } catch (err) {
        console.error(err);
        triggerFeedback('Erro ao salvar no banco. Adicionado localmente.', 'error');
      }
    } else {
      setReceitas([...receitas, { id: 'r_' + Date.now(), ...item }]);
      triggerFeedback('Receita cadastrada com sucesso!');
    }
    setRecDesc('');
    setRecVal('');
  };

  // REMOVER RECEITA
  const deleteReceita = async (id: string) => {
    if (!useLocalData && user && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'receitas', id));
    } else {
      setReceitas(receitas.filter(r => r.id !== id));
    }
    triggerFeedback('Receita removida.');
  };

  // ADICIONAR DESPESA
  const addDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desDesc || !desVal) return;
    const item = {
      descricao: desDesc,
      categoria: desCat,
      valor: parseFloat(desVal),
      data: desDate,
      pagamento: desPay,
      recorrente: desRecorrente,
      frequencia: desFreq
    };

    if (!useLocalData && user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'despesas'), item);
        triggerFeedback('Despesa cadastrada!');
      } catch (err) {
        console.error(err);
      }
    } else {
      setDespesas([...despesas, { id: 'd_' + Date.now(), ...item }]);
      triggerFeedback('Despesa cadastrada!');
    }
    setDesDesc('');
    setDesVal('');
  };

  // REMOVER DESPESA
  const deleteDespesa = async (id: string) => {
    if (!useLocalData && user && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'despesas', id));
    } else {
      setDespesas(despesas.filter(d => d.id !== id));
    }
    triggerFeedback('Despesa removida.');
  };

  // ADICIONAR PARCELAMENTO
  const addParcelamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parName || !parTotalVal || !parQtd) return;
    const vTotal = parseFloat(parTotalVal);
    const qtd = parseInt(parQtd);
    const pAtual = parseInt(parAtual);
    const vParcela = parseFloat((vTotal / qtd).toFixed(2));

    const item = {
      nome: parName,
      valorTotal: vTotal,
      parcelasQtd: qtd,
      parcelaAtual: pAtual,
      valorParcela: vParcela,
      dataVencimento: parDate
    };

    if (!useLocalData && user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'parcelamentos'), item);
        triggerFeedback('Parcelamento adicionado!');
      } catch (err) {
        console.error(err);
      }
    } else {
      setParcelamentos([...parcelamentos, { id: 'p_' + Date.now(), ...item }]);
      triggerFeedback('Parcelamento adicionado!');
    }
    setParName('');
    setParTotalVal('');
    setParQtd('');
    setParAtual('1');
  };

  // ATUALIZAR PARCELAMENTO (Avançar Parcela)
  const avancarParcela = async (item: Parcelamento) => {
    const novaAtual = item.parcelaAtual + 1;
    if (novaAtual > item.parcelasQtd) {
      triggerFeedback('Este parcelamento já está completamente pago! Remova-o ou conclua-o.', 'info');
      return;
    }

    if (!useLocalData && user && db) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'parcelamentos', item.id), {
        parcelaAtual: novaAtual
      });
    } else {
      setParcelamentos(parcelamentos.map(p => p.id === item.id ? { ...p, parcelaAtual: novaAtual } : p));
    }
    triggerFeedback(`Parcela do item "${item.nome}" avançada para ${novaAtual}/${item.parcelasQtd}.`);
  };

  // REMOVER PARCELAMENTO
  const deleteParcelamento = async (id: string) => {
    if (!useLocalData && user && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'parcelamentos', id));
    } else {
      setParcelamentos(parcelamentos.filter(p => p.id !== id));
    }
    triggerFeedback('Parcelamento removido.');
  };

  // ADICIONAR EMPRÉSTIMO
  const addEmprestimo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empInst || !empVal || !empQtd) return;
    const vContratado = parseFloat(empVal);
    const taxa = parseFloat(empJuros || '0');
    const qtd = parseInt(empQtd);
    
    // Cálculo de parcela simples Price ou aproximada caso valorParcela não seja definido
    let vParcela = parseFloat(empParVal);
    if (!vParcela) {
      const i = (taxa / 100);
      if (i > 0) {
        vParcela = parseFloat(((vContratado * i) / (1 - Math.pow(1 + i, -qtd))).toFixed(2));
      } else {
        vParcela = parseFloat((vContratado / qtd).toFixed(2));
      }
    }

    const item = {
      instituicao: empInst,
      valorContratado: vContratado,
      taxaJuros: taxa,
      parcelasQtd: qtd,
      parcelaAtual: 1,
      valorParcela: vParcela,
      dataInicial: empDateStart
    };

    if (!useLocalData && user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'emprestimos'), item);
        triggerFeedback('Empréstimo registrado!');
      } catch (err) {
        console.error(err);
      }
    } else {
      setEmprestimos([...emprestimos, { id: 'e_' + Date.now(), ...item }]);
      triggerFeedback('Empréstimo registrado!');
    }
    setEmpInst('');
    setEmpVal('');
    setEmpJuros('');
    setEmpQtd('');
    setEmpParVal('');
  };

  // REMOVER EMPRÉSTIMO
  const deleteEmprestimo = async (id: string) => {
    if (!useLocalData && user && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'emprestimos', id));
    } else {
      setEmprestimos(emprestimos.filter(e => e.id !== id));
    }
    triggerFeedback('Empréstimo removido.');
  };

  // ATUALIZAR PARCELA EMPRÉSTIMO
  const pagarParcelaEmprestimo = async (item: Emprestimo) => {
    const novaAtual = item.parcelaAtual + 1;
    if (novaAtual > item.parcelasQtd) {
      triggerFeedback('Este empréstimo está totalmente liquidado!', 'success');
      return;
    }

    if (!useLocalData && user && db) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'emprestimos', item.id), {
        parcelaAtual: novaAtual
      });
    } else {
      setEmprestimos(emprestimos.map(e => e.id === item.id ? { ...e, parcelaAtual: novaAtual } : e));
    }
    triggerFeedback(`Parcela do empréstimo avançada para ${novaAtual}/${item.parcelasQtd}.`);
  };

  // ADICIONAR IMPOSTO
  const addImposto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impTotal) return;
    const total = parseFloat(impTotal);
    const qtd = parseInt(impQtd);
    const pagas = parseInt(impPagas || '0');
    const vPar = parseFloat((total / qtd).toFixed(2));

    const item = {
      descricao: impDesc,
      valorTotal: total,
      parcelasQtd: qtd,
      parcelasPagas: pagas,
      valorParcela: vPar,
      dataVencimento: new Date().toISOString().split('T')[0]
    };

    if (!useLocalData && user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'impostos'), item);
        triggerFeedback('Imposto de Renda registrado!');
      } catch (err) {
        console.error(err);
      }
    } else {
      setImpostos([...impostos, { id: 'i_' + Date.now(), ...item }]);
      triggerFeedback('Imposto de Renda registrado!');
    }
    setImpTotal('');
  };

  // REMOVER IMPOSTO
  const deleteImposto = async (id: string) => {
    if (!useLocalData && user && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'impostos', id));
    } else {
      setImpostos(impostos.filter(i => i.id !== id));
    }
    triggerFeedback('Imposto removido.');
  };

  // PAGAR PARCELA IMPOSTO
  const pagarParcelaImposto = async (item: Imposto) => {
    const pagas = item.parcelasPagas + 1;
    if (pagas > item.parcelasQtd) {
      triggerFeedback('Este imposto de renda já foi totalmente pago!', 'success');
      return;
    }

    if (!useLocalData && user && db) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'impostos', item.id), {
        parcelasPagas: pagas
      });
    } else {
      setImpostos(impostos.map(i => i.id === item.id ? { ...i, parcelasPagas: pagas } : i));
    }
    triggerFeedback(`Parcela de Imposto paga: ${pagas}/${item.parcelasQtd}`);
  };

  // SALVAR CONFIGURAÇÃO DA RESERVA
  const saveReservaConfig = async (meta: string, atual: string, mensal: string) => {
    const metaNum = parseFloat(meta) || 0;
    const atualNum = parseFloat(atual) || 0;
    const mensalNum = parseFloat(mensal) || 0;

    if (!useLocalData && user && db) {
      try {
        const docReserva = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'reserva');
        await setDoc(docReserva, { meta: metaNum, atual: atualNum, mensal: mensalNum });
        triggerFeedback('Configuração da Reserva de Emergência atualizada!');
      } catch (err) {
        console.error(err);
      }
    } else {
      setReservaMeta(metaNum);
      setReservaAtual(atualNum);
      setReservaMensal(mensalNum);
      triggerFeedback('Configuração da Reserva de Emergência atualizada!');
    }
  };

  // --- CÁLCULOS E DERIVAÇÕES EM TEMPO REAL ---

  // Receitas Totais do Mês Ativo (Junho de 2026): Soma as Recorrentes + as Pontuais do mês 06/2026
  const totalReceitas = useMemo(() => {
    return receitas.reduce((acc, r) => {
      if (r.recorrente === 'Sim') return acc + r.valor;
      
      const rDate = new Date(r.data);
      // Se for pontual, só soma se for de Junho (mês 5) de 2026
      if (rDate.getMonth() === 5 && rDate.getFullYear() === 2026) {
        return acc + r.valor;
      }
      return acc;
    }, 0);
  }, [receitas]);

  // Despesas Totais do Mês Ativo (Junho de 2026): Soma as Recorrentes + as Pontuais do mês 06/2026
  const totalDespesas = useMemo(() => {
    return despesas.reduce((acc, d) => {
      if (d.recorrente === 'Sim') return acc + d.valor;

      const dDate = new Date(d.data);
      // Se for pontual, só soma se for de Junho (mês 5) de 2026
      if (dDate.getMonth() === 5 && dDate.getFullYear() === 2026) {
        return acc + d.valor;
      }
      return acc;
    }, 0);
  }, [despesas]);

  const totalParcelasMensal = useMemo(() => {
    return parcelamentos.reduce((acc, p) => acc + (p.parcelaAtual < p.parcelasQtd ? p.valorParcela : 0), 0);
  }, [parcelamentos]);

  const totalEmprestimosMensal = useMemo(() => {
    return emprestimos.reduce((acc, e) => acc + (e.parcelaAtual < e.parcelasQtd ? e.valorParcela : 0), 0);
  }, [emprestimos]);

  const totalImpostosMensal = useMemo(() => {
    return impostos.reduce((acc, i) => acc + (i.parcelasPagas < i.parcelasQtd ? i.valorParcela : 0), 0);
  }, [impostos]);

  // Saldo do Mês Corrente
  const saldoAtual = useMemo(() => {
    return totalReceitas - (totalDespesas + totalParcelasMensal + totalEmprestimosMensal + totalImpostosMensal);
  }, [totalReceitas, totalDespesas, totalParcelasMensal, totalEmprestimosMensal, totalImpostosMensal]);

  // Dívida Total (Saldo Devedor Restante)
  const dividaTotalRestante = useMemo(() => {
    const parcResta = parcelamentos.reduce((acc, p) => acc + ((p.parcelasQtd - p.parcelaAtual) * p.valorParcela), 0);
    const empResta = emprestimos.reduce((acc, e) => acc + ((e.parcelasQtd - e.parcelaAtual) * e.valorParcela), 0);
    const impResta = impostos.reduce((acc, i) => acc + ((i.parcelasQtd - i.parcelasPagas) * i.valorParcela), 0);
    return parcResta + empResta + impResta;
  }, [parcelamentos, emprestimos, impostos]);

  // Total das Dívidas que vencem este mês (Comprometimento de Renda)
  const totalDividasEsteMes = useMemo(() => {
    return totalParcelasMensal + totalEmprestimosMensal + totalImpostosMensal;
  }, [totalParcelasMensal, totalEmprestimosMensal, totalImpostosMensal]);

  // Taxa de Comprometimento de Renda
  const comprometimentoRenda = useMemo(() => {
    if (totalReceitas === 0) return 0;
    return parseFloat(((totalDividasEsteMes / totalReceitas) * 100).toFixed(1));
  }, [totalDividasEsteMes, totalReceitas]);

  // Classificação do comprometimento
  const statusComprometimento = useMemo(() => {
    if (comprometimentoRenda <= 30) return { label: 'Saudável', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', badge: '🟢' };
    if (comprometimentoRenda <= 40) return { label: 'Atenção', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', badge: '🟡' };
    return { label: 'Risco Crítico', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', badge: '🔴' };
  }, [comprometimentoRenda]);

  // --- SIMULADOR INTELIGENTE DE FINANÇAS ---
  const handleSimulacao = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(simVal);
    const p = parseInt(simParc || '1');
    const j = parseFloat(simJuros || '0');

    if (!v) return;

    let valorMensal = 0;
    if (simType === 'emprestimo' || simType === 'financiamento') {
      const i = (j / 100);
      if (i > 0) {
        valorMensal = parseFloat(((v * i) / (1 - Math.pow(1 + i, -p))).toFixed(2));
      } else {
        valorMensal = parseFloat((v / p).toFixed(2));
      }
    } else {
      valorMensal = parseFloat((v / p).toFixed(2));
    }

    const novoComprometimentoTotal = totalDividasEsteMes + valorMensal;
    const novaTaxa = totalReceitas > 0 ? parseFloat(((novoComprometimentoTotal / totalReceitas) * 100).toFixed(1)) : 100;
    
    let classificacao = 'Saudável';
    let cor = 'text-emerald-400';
    if (novaTaxa > 30 && novaTaxa <= 40) { classificacao = 'Atenção'; cor = 'text-amber-400'; }
    if (novaTaxa > 40) { classificacao = 'Risco'; cor = 'text-rose-400'; }

    setSimResultado({
      nome: simName,
      valorTotal: v,
      parcelas: p,
      valorMensal,
      taxaAtual: comprometimentoRenda,
      taxaFutura: novaTaxa,
      classificacao,
      cor,
      impactoSaldo: saldoAtual - valorMensal
    });
  };

  // --- DIAGNÓSTICO FINANCEIRO COMPLETO ---
  const rodarDiagnostico = () => {
    setIsAnalisando(true);
    setTimeout(() => {
      const taxaEndividamento = totalReceitas > 0 ? parseFloat(((dividaTotalRestante / (totalReceitas * 12)) * 100).toFixed(1)) : 100;
      const capPagamento = totalReceitas - totalDespesas - totalDividasEsteMes;
      const recomendadoReserva = (totalDespesas + totalDividasEsteMes) * 6; // 6 meses de todas as saídas

      let nivel = 'Saudável 🟢';
      let sugestoes: string[] = [];
      let corFundo = 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30';
      let corTexto = 'text-emerald-400';

      if (comprometimentoRenda > 40 || taxaEndividamento > 50) {
        nivel = 'Crítico 🔴';
        corFundo = 'from-rose-500/10 to-rose-500/5 border-rose-500/30';
        corTexto = 'text-rose-400';
        sugestoes = [
          'Priorize a renegociação imediata dos empréstimos com juros acima de 3% a.m.',
          'Corte temporariamente despesas não essenciais de Lazer e Compras até o comprometimento cair para <30%.',
          'Evite fazer novas compras parceladas ou assinaturas recorrentes nos próximos 90 dias.',
          'Considere utilizar 20% do saldo mensal de free-lances diretamente para amortizar o empréstimo mais caro.'
        ];
      } else if (comprometimentoRenda > 30 || taxaEndividamento > 25) {
        nivel = 'Atenção 🟡';
        corFundo = 'from-amber-500/10 to-amber-500/5 border-amber-500/30';
        corTexto = 'text-amber-400';
        sugestoes = [
          'Seu fluxo está estável, mas você tem baixo poder de poupança no momento.',
          'Busque transferir saldos de cartões caros para empréstimos mais baratos, se aplicável.',
          'Tente aumentar o aporte mensal de sua Reserva de Emergência para atingir a meta mais rápido.',
          'Revise contas fixas como planos de Celular e Internet para otimizar custos mensais.'
        ];
      } else {
        sugestoes = [
          'Parabéns! Suas finanças estão sob controle absoluto e com baixíssimo comprometimento.',
          'Aproveite a folga no orçamento para aumentar os investimentos em renda fixa ou variável.',
          'Seu fundo de emergência está avançando bem. Continue consistente.',
          'Aproveite para planejar metas de longo prazo, como compra de ativos à vista sem necessidade de juros.'
        ];
      }

      setAnaliseResultado({
        nivel,
        corFundo,
        corTexto,
        taxaEndividamento,
        capPagamento,
        recomendadoReserva,
        sugestoes,
        dataAnalise: new Date().toLocaleDateString('pt-BR')
      });
      setIsAnalisando(false);
    }, 1200);
  };

  // --- PROJEÇÕES FUTURAS (6, 12, 24 MESES) ---
  const projecaoFluxoCaixa = useMemo(() => {
    const mesesProjetados = [];
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dataAtual = new Date(2026, 5, 1); // Começando em Junho de 2026

    let saldoAcumulado = saldoAtual;

    for (let i = 1; i <= projecaoMeses; i++) {
      const dataMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, 1);
      const nomeMes = `${nomesMeses[dataMes.getMonth()]}/${dataMes.getFullYear().toString().substring(2)}`;

      // Cálculo de receitas previstas para o mês futuro
      const recipesPrevistas = receitas.reduce((sum, r) => {
        if (r.recorrente === 'Sim') return sum + r.valor;
        // Se for pontual, só entra no mês específico de vencimento
        const rDate = new Date(r.data);
        if (rDate.getMonth() === dataMes.getMonth() && rDate.getFullYear() === dataMes.getFullYear()) {
          return sum + r.valor;
        }
        return sum;
      }, 0);

      // Despesas fixas e despesas recorrentes dinâmicas previstas para o mês futuro
      const despesasPrevistas = despesas.reduce((sum, d) => {
        if (d.recorrente === 'Sim') return sum + d.valor;
        // Se for despesa pontual, entra no vencimento correspondente
        const dDate = new Date(d.data);
        if (dDate.getMonth() === dataMes.getMonth() && dDate.getFullYear() === dataMes.getFullYear()) {
          return sum + d.valor;
        }
        return sum;
      }, 0);

      // Parcelas ativas no mês futuro
      const parcelasFuturas = parcelamentos.reduce((sum, p) => {
        const parcelasRestantes = p.parcelasQtd - p.parcelaAtual;
        if (i <= parcelasRestantes) {
          return sum + p.valorParcela;
        }
        return sum;
      }, 0);

      // Empréstimos ativos no mês futuro
      const emprestimosFuturos = emprestimos.reduce((sum, e) => {
        const parcelasRestantes = e.parcelasQtd - e.parcelaAtual;
        if (i <= parcelasRestantes) {
          return sum + e.valorParcela;
        }
        return sum;
      }, 0);

      // Impostos ativos no mês futuro
      const impostosFuturos = impostos.reduce((sum, imp) => {
        const parcelasRestantes = imp.parcelasQtd - imp.parcelasPagas;
        if (i <= parcelasRestantes) {
          return sum + imp.valorParcela;
        }
        return sum;
      }, 0);

      const totalSaidasFuturas = despesasPrevistas + parcelasFuturas + emprestimosFuturos + impostosFuturos;
      const saldoDoMes = recipesPrevistas - totalSaidasFuturas;
      saldoAcumulado += saldoDoMes;

      mesesProjetados.push({
        mes: nomeMes,
        receitas: recipesPrevistas,
        despesas: totalSaidasFuturas,
        saldo: saldoDoMes,
        acumulado: saldoAcumulado
      });
    }

    return mesesProjetados;
  }, [receitas, despesas, parcelamentos, emprestimos, impostos, saldoAtual, projecaoMeses]);

  // --- ALERTAS INTELIGENTES (Sem componentes de ícones dinâmicos nas propriedades do objeto) ---
  const alertasAtivos = useMemo(() => {
    const alerts = [];
    if (comprometimentoRenda > 40) {
      alerts.push({
        tipo: 'erro',
        mensagem: `Seu comprometimento de renda atingiu ${comprometimentoRenda}%! Isso indica alto risco de inadimplência.`
      });
    } else if (comprometimentoRenda > 30) {
      alerts.push({
        tipo: 'aviso',
        mensagem: `Atenção: Seu comprometimento de renda está em ${comprometimentoRenda}%, limiar de segurança recomendado.`
      });
    }

    // Alertas de vencimentos nos próximos 7 dias
    const hoje = new Date(2026, 5, 3); // 3 de Junho de 2026
    let contasProximas = 0;
    despesas.forEach(d => {
      const dDate = new Date(d.data);
      const diffTime = dDate.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 7) contasProximas++;
    });

    if (contasProximas > 0) {
      alerts.push({
        tipo: 'info',
        mensagem: `Você possui ${contasProximas} despesa(s) vencendo nos próximos 7 dias. Organize seu fluxo de caixa.`
      });
    }

    // Alerta de impostos pendentes
    const impostosAtivos = impostos.filter(i => i.parcelasPagas < i.parcelasQtd);
    if (impostosAtivos.length > 0) {
      alerts.push({
        tipo: 'aviso',
        mensagem: `O imposto "${impostosAtivos[0].descricao}" possui parcelas pendentes de pagamento. Evite multas fiscais.`
      });
    }

    // Alerta de projeção negativa
    const temProjecaoNegativa = projecaoFluxoCaixa.some(m => m.acumulado < 0);
    if (temProjecaoNegativa) {
      const mesNeg = projecaoFluxoCaixa.find(m => m.acumulado < 0);
      alerts.push({
        tipo: 'erro',
        mensagem: `Aviso Crítico: Sua projeção de fluxo de caixa acumulado indica saldo negativo em ${mesNeg?.mes}.`
      });
    }

    return alerts;
  }, [comprometimentoRenda, despesas, impostos, projecaoFluxoCaixa]);

  // --- EXPORTAÇÃO DE RELATÓRIO EM TELA ---
  const exportarDados = () => {
    const dadosExport = {
      relatorioGeradoEm: new Date().toLocaleString(),
      receitas,
      despesas,
      parcelamentos,
      emprestimos,
      impostos,
      kpis: {
        totalReceitas,
        totalDespesas,
        saldoDoMesa: saldoAtual,
        dividaTotalRestante,
        comprometimentoRenda
      }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dadosExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "finance_planner_report.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerFeedback('Relatório exportado com sucesso como JSON!');
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false);
  };

  return (
    <div className={`app-root font-sans ${!darkMode ? 'theme-light' : ''}`}>

      {/* --- NOTIFICAÇÕES TOAST --- */}
      {feedbackMsg && (
        <div className={`toast ${
          feedbackMsg.type === 'error' ? 'toast-error' :
          feedbackMsg.type === 'info'  ? 'toast-info'  : 'toast-success'
        }`}>
          {feedbackMsg.type === 'error' ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{feedbackMsg.text}</span>
        </div>
      )}

      {/* --- CABEÇALHO --- */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-indigo-600 rounded-xl shadow-lg shadow-emerald-500/10">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                Finance Planner Pro
              </h1>
              <span className="hidden sm:block text-xs text-slate-400 font-medium">Controle Inteligente Integrado</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* MODO CLARO/ESCURO */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'
            }`}
            title="Alternar Tema"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* SESSÃO DO USUÁRIO */}
          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-slate-200">{user.displayName || 'Planejador'}</p>
                <p className="text-xs text-emerald-400 font-medium flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  {useLocalData ? 'Sessão Local' : 'Nuvem Sincronizada'}
                </p>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl text-sm font-medium transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setActiveTab('auth');
                setSidebarOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/15"
            >
              <LogIn className="w-4 h-4" />
              <span>Acessar Conta</span>
            </button>
          )}
        </div>
      </header>

      {/* Overlay para fechar sidebar no mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex min-h-[calc(100vh-73px)]">

        {/* --- MENU LATERAL (SIDEBAR) --- */}
        <aside className={`app-sidebar ${sidebarOpen ? 'w-64 sidebar-open' : 'w-0'}`}>
          <div className="p-4 flex flex-col gap-2">
            
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Módulos</p>
            
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LineChart className="w-4 h-4" />
              <span>Dashboard Principal</span>
            </button>

            <button
              onClick={() => handleNavClick('receitas')}
              className={`nav-link ${activeTab === 'receitas' ? 'active' : ''}`}
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span>Receitas</span>
            </button>

            <button
              onClick={() => handleNavClick('despesas')}
              className={`nav-link ${activeTab === 'despesas' ? 'active' : ''}`}
            >
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
              <span>Despesas</span>
            </button>

            <button
              onClick={() => handleNavClick('parcelamentos')}
              className={`nav-link ${activeTab === 'parcelamentos' ? 'active' : ''}`}
            >
              <CreditCard className="w-4 h-4 text-sky-500" />
              <span>Parcelamentos</span>
            </button>

            <button
              onClick={() => handleNavClick('emprestimos')}
              className={`nav-link ${activeTab === 'emprestimos' ? 'active' : ''}`}
            >
              <Calculator className="w-4 h-4 text-amber-500" />
              <span>Empréstimos</span>
            </button>

            <button
              onClick={() => handleNavClick('impostos')}
              className={`nav-link ${activeTab === 'impostos' ? 'active' : ''}`}
            >
              <Percent className="w-4 h-4 text-indigo-400" />
              <span>Imposto de Renda (IRPF)</span>
            </button>

            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2">Simulações & Análises</p>

            <button
              onClick={() => handleNavClick('simulador')}
              className={`nav-link ${activeTab === 'simulador' ? 'active' : ''}`}
            >
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              <span>Simulador de Impacto</span>
            </button>

            <button
              onClick={() => handleNavClick('reserva')}
              className={`nav-link ${activeTab === 'reserva' ? 'active' : ''}`}
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Reserva de Emergência</span>
            </button>

            <button
              onClick={() => handleNavClick('diagnostico')}
              className={`nav-link ${activeTab === 'diagnostico' ? 'active' : ''}`}
            >
              <Sparkles className="w-4 h-4 text-fuchsia-400 animate-pulse" />
              <span>Diagnóstico Inteligente</span>
            </button>

            <button
              onClick={() => handleNavClick('relatorios')}
              className={`nav-link ${activeTab === 'relatorios' ? 'active' : ''}`}
            >
              <FileText className="w-4 h-4" />
              <span>Relatórios Completos</span>
            </button>
          </div>
        </aside>

        {/* --- CONTEÚDO PRINCIPAL (PAINÉIS SELECIONADOS) --- */}
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto max-w-7xl mx-auto w-full">

          {/* COMPONENTE DE ALERTAS CRÍTICOS GLOBAIS */}
          {alertasAtivos.length > 0 && activeTab !== 'auth' && (
            <div className="mb-6 flex flex-col gap-3">
              {alertasAtivos.map((alerta, index) => (
                <div key={index} className={`alert-banner ${
                  alerta.tipo === 'erro'  ? 'alert-error'   :
                  alerta.tipo === 'aviso' ? 'alert-warning' : 'alert-info'
                }`}>
                  {renderAlertaIcon(alerta.tipo)}
                  <div className="text-sm">
                    <span className="font-semibold block">Alerta do Sistema:</span>
                    {alerta.mensagem}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 1: DASHBOARD PRINCIPAL */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Painel de Resumo Geral</h2>
                  <p className="text-sm text-slate-400">Análise de receitas, despesas, parcelas e projeções simuladas.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-400">Mês de Referência:</span>
                  <span className="px-3 py-1.5 bg-slate-800 text-emerald-400 border border-slate-700 rounded-xl text-sm font-bold">Junho / 2026</span>
                </div>
              </div>

              {/* CARDS DE KPI (Mês Atual) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* RECEITA DO MÊS */}
                <div className={`p-5 rounded-2xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400 font-semibold">Receitas do Mês</span>
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-emerald-400">
                    R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <span className="text-emerald-400 font-bold">Ativas & Recorrentes</span> aplicadas.
                  </p>
                </div>

                {/* TOTAL DE SAÍDAS */}
                <div className={`p-5 rounded-2xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400 font-semibold">Total de Saídas</span>
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                      <ArrowDownRight className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-rose-400">
                    R$ {(totalDespesas + totalDividasEsteMes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Desp. correntes R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + dívidas R$ {totalDividasEsteMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* COMPROMETIMENTO DA RENDA */}
                <div className={`p-5 rounded-2xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400 font-semibold">Comprometimento de Renda</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${statusComprometimento.color}`}>
                      {statusComprometimento.badge} {statusComprometimento.label}
                    </div>
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    {comprometimentoRenda}%
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Total mensal em dívidas: R$ {totalDividasEsteMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* SALDO DO MÊS */}
                <div className={`p-5 rounded-2xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400 font-semibold">Saldo Líquido Projetado</span>
                    <div className={`p-2 rounded-lg ${saldoAtual >= 0 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className={`text-2xl font-extrabold tracking-tight ${saldoAtual >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                    R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Receitas − Total de Saídas (despesas + dívidas).
                  </p>
                </div>

              </div>

              {/* ADICIONAL DE DÍVIDAS TOTAIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">Valor Total Parcelado</p>
                    <p className="text-lg font-bold text-sky-400">R$ {parcelamentos.reduce((acc, p) => acc + ((p.parcelasQtd - p.parcelaAtual) * p.valorParcela), 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-sky-500/45" />
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">Saldo Devedor Empréstimos</p>
                    <p className="text-lg font-bold text-amber-400">R$ {emprestimos.reduce((acc, e) => acc + ((e.parcelasQtd - e.parcelaAtual) * e.valorParcela), 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <Calculator className="w-8 h-8 text-amber-500/45" />
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">Dívida Consolidada Restante</p>
                    <p className="text-lg font-bold text-indigo-400">R$ {dividaTotalRestante.toLocaleString('pt-BR')}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-indigo-500/45" />
                </div>
              </div>

              {/* SEÇÃO DE GRÁFICOS DO FLUXO DE CAIXA E COMPROMETIMENTO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* GRÁFICO 1: EVOLUÇÃO E PROJEÇÃO DE CAIXA (SVG Customizado) */}
                <div className={"p-6 app-card"}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-md font-bold">Projeção Acumulada de Saldo ({projecaoMeses} meses)</h4>
                      <p className="text-xs text-slate-400">Demonstrativo baseado em receitas/despesas recorrentes e quitação de parcelas.</p>
                    </div>
                    <select 
                      value={projecaoMeses}
                      onChange={(e) => setProjecaoMeses(parseInt(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-sm rounded-lg p-1.5 outline-none focus:border-indigo-500 text-slate-200"
                    >
                      <option value={6}>6 Meses</option>
                      <option value={12}>12 Meses</option>
                      <option value={24}>24 Meses</option>
                    </select>
                  </div>

                  <div className="h-64 flex flex-col justify-between mt-4">
                    {/* SVG Dinâmico para renderizar as Barras e Linhas de Acumulado */}
                    <div className="relative w-full h-48 bg-slate-950/40 rounded-xl p-2 border border-slate-800/50 overflow-hidden flex items-end justify-between">
                      {projecaoFluxoCaixa.map((item, idx) => {
                        const maxVal = Math.max(...projecaoFluxoCaixa.map(m => Math.abs(m.acumulado)), 10000);
                        const percentAcumulado = Math.min(Math.max((item.acumulado / maxVal) * 80, -80), 80);
                        const isNeg = item.acumulado < 0;

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative px-1">
                            {/* Linha invisível de hover com tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 text-[10px] p-2 rounded shadow-xl z-20 whitespace-nowrap">
                              <p className="font-bold text-slate-200">{item.mes}</p>
                              <p className="text-emerald-400">Rec: R$ {item.receitas.toFixed(0)}</p>
                              <p className="text-rose-400">Saí: R$ {item.despesas.toFixed(0)}</p>
                              <p className="text-indigo-400 border-t border-slate-800 mt-1">Acum: R$ {item.acumulado.toFixed(0)}</p>
                            </div>

                            {/* Barra de Receita x Despesa */}
                            <div className="w-full flex justify-center gap-1">
                              <div className="w-1.5 bg-emerald-500/30 group-hover:bg-emerald-500 rounded-t-sm" style={{ height: `${Math.min((item.receitas / maxVal) * 100, 100)}px` }} />
                              <div className="w-1.5 bg-rose-500/30 group-hover:bg-rose-500 rounded-t-sm" style={{ height: `${Math.min((item.despesas / maxVal) * 100, 100)}px` }} />
                            </div>

                            {/* Ponto / Barra do Acumulado */}
                            <div 
                              className={`w-3 rounded mt-1 transition-all ${isNeg ? 'bg-rose-600 shadow-lg shadow-rose-600/30' : 'bg-indigo-500 shadow-lg shadow-indigo-500/30'}`} 
                              style={{ height: `${Math.max(Math.abs(percentAcumulado), 6)}px` }}
                            />

                            <span className="text-[9px] font-semibold text-slate-500 mt-2 block">{item.mes}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 px-1 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500/50 rounded-sm"></span>
                        <span>Receitas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-rose-500/50 rounded-sm"></span>
                        <span>Despesas / Contas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span>
                        <span>Saldo Projetado</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRÁFICO 2: DESPESAS POR CATEGORIA (SVG Rosca de Distribuição) */}
                <div className={"p-6 app-card"}>
                  <h4 className="text-md font-bold mb-2">Composição Mensal de Despesas</h4>
                  <p className="text-xs text-slate-400 mb-4">Proporção das despesas em relação ao limite do seu saldo total de saída.</p>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6 justify-around">
                    {/* SVG Simulado de Pizza/Rosca */}
                    <div className="relative w-36 h-36">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="3" />
                        
                        {/* Seção 1 (Moradia) */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f43f5e" strokeWidth="4.2" 
                          strokeDasharray="40 100" strokeDashoffset="0" />
                        
                        {/* Seção 2 (Alimentação) */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.2" 
                          strokeDasharray="25 100" strokeDashoffset="-40" />

                        {/* Seção 3 (Dívidas / Parcelas) */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#6366f1" strokeWidth="4.2" 
                          strokeDasharray="35 100" strokeDashoffset="-65" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-slate-400 font-semibold uppercase">Saídas</span>
                        <span className="text-sm font-extrabold text-slate-200">
                          R$ {(totalDespesas + totalDividasEsteMes).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Legenda Lateral com dados reais */}
                    <div className="flex-1 space-y-2.5 w-full text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800/40 pb-1">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Moradia e Fixo</span>
                        <span className="font-bold text-slate-300">R$ {totalDespesas.toFixed(0)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800/40 pb-1">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>Dívidas/Parcelas</span>
                        <span className="font-bold text-slate-300">R$ {totalParcelasMensal.toFixed(0)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800/40 pb-1">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Empréstimos</span>
                        <span className="font-bold text-slate-300">R$ {totalEmprestimosMensal.toFixed(0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>Impostos</span>
                        <span className="font-bold text-slate-300">R$ {totalImpostosMensal.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* SEÇÃO PRÓXIMOS VENCIMENTOS DO MÊS */}
              <div className={"p-6 app-card"}>
                <h4 className="text-md font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  Compromissos Financeiros Relevantes (Próximos)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="pb-3">Descrição / Item</th>
                        <th className="pb-3">Categoria</th>
                        <th className="pb-3">Vencimento</th>
                        <th className="pb-3">Recorrência</th>
                        <th className="pb-3 text-right">Valor Parcela</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {despesas.slice(0, 4).map((d) => (
                        <tr key={d.id} className="text-slate-300">
                          <td className="py-3.5 font-medium">{d.descricao}</td>
                          <td className="py-3.5 text-slate-400">{d.categoria}</td>
                          <td className="py-3.5">{d.data}</td>
                          <td className="py-3.5">
                            {d.recorrente === 'Sim' ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-xs font-semibold">Recorrente ({d.frequencia})</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md text-xs font-semibold">Única</span>
                            )}
                          </td>
                          <td className="py-3.5 text-right font-bold text-slate-200">R$ {d.valor.toFixed(2)}</td>
                        </tr>
                      ))}
                      {parcelamentos.map((p) => (
                        <tr key={p.id} className="text-slate-300">
                          <td className="py-3.5 font-medium">{p.nome} <span className="text-[10px] text-indigo-400 font-bold ml-1">({p.parcelaAtual}/{p.parcelasQtd})</span></td>
                          <td className="py-3.5 text-slate-400">Parcelamento</td>
                          <td className="py-3.5">{p.dataVencimento || 'Mensal'}</td>
                          <td className="py-3.5">
                            <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded-md text-xs font-semibold">Parcelas Ativas</span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-sky-400">R$ {p.valorParcela.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECEITAS */}
          {activeTab === 'receitas' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-emerald-400">Gerenciamento de Receitas</h2>
                  <p className="text-sm text-slate-400">Acompanhe e configure suas entradas de capital e fluxos recorrentes.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORM ADICIONAR */}
                <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} lg:col-span-1 h-fit`}>
                  <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-emerald-400">
                    <Plus className="w-5 h-5" />
                    Nova Entrada
                  </h3>
                  <form onSubmit={addReceita} className="space-y-4">
                    <div>
                      <label className="form-label">Descrição</label>
                      <input 
                        type="text" 
                        value={recDesc}
                        onChange={(e) => setRecDesc(e.target.value)}
                        placeholder="Ex: Consultoria Tech"
                        className="form-input"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Categoria</label>
                        <select 
                          value={recCat}
                          onChange={(e) => setRecCat(e.target.value)}
                          className="form-select"
                        >
                          <option value="Salário">Salário</option>
                          <option value="Freela">Freela</option>
                          <option value="SaaS">SaaS</option>
                          <option value="Comissão">Comissão</option>
                          <option value="Investimento">Investimento</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Valor (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={recVal}
                          onChange={(e) => setRecVal(e.target.value)}
                          placeholder="0,00"
                          className="form-input font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Data de Recebimento</label>
                      <input 
                        type="date" 
                        value={recDate}
                        onChange={(e) => setRecDate(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Recorrente?</label>
                        <select 
                          value={recRecorrente}
                          onChange={(e) => setRecRecorrente(e.target.value)}
                          className="form-select"
                        >
                          <option value="Sim">Sim (Não expira)</option>
                          <option value="Nao">Não (Lançamento Único)</option>
                        </select>
                      </div>
                      {recRecorrente === 'Sim' && (
                        <div>
                          <label className="form-label">Frequência</label>
                          <select 
                            value={recFreq}
                            onChange={(e) => setRecFreq(e.target.value)}
                            className="form-select"
                          >
                            <option value="Mensal">Mensal</option>
                            <option value="Semanal">Semanal</option>
                            <option value="Anual">Anual</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit"
                      className="btn-full btn-emerald"
                    >
                      Salvar Receita
                    </button>
                  </form>
                </div>

                {/* TABELA DE REGISTROS */}
                <div className={"p-6 app-card lg:col-span-2"}>
                  <h3 className="text-md font-bold mb-4">Fontes Ativas</h3>
                  <div className="space-y-3">
                    {receitas.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">Nenhuma receita registrada.</p>
                    ) : (
                      receitas.map((rec) => (
                        <div key={rec.id} className="flex items-center justify-between p-4 bg-slate-950/45 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                          <div>
                            <p className="font-semibold text-slate-100">{rec.descricao}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded text-[10px] font-medium uppercase">{rec.categoria}</span>
                              {rec.recorrente === 'Sim' ? (
                                <span className="px-2 py-0.5 bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold">Recorrente: {rec.frequencia}</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-semibold">Pontual</span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium">Data: {rec.data}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-emerald-400">R$ {rec.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <button 
                              onClick={() => deleteReceita(rec.id)}
                              className="btn-delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: DESPESAS */}
          {activeTab === 'despesas' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-rose-400">Controle de Despesas</h2>
                <p className="text-sm text-slate-400">Monitore despesas pontuais e crie cobranças recorrentes automáticas sem precisar lançá-las todo mês.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* FORM */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-rose-400">
                    <Plus className="w-5 h-5" />
                    Registrar Gasto
                  </h3>
                  <form onSubmit={addDespesa} className="space-y-4">
                    <div>
                      <label className="form-label">Descrição</label>
                      <input 
                        type="text" 
                        value={desDesc}
                        onChange={(e) => setDesDesc(e.target.value)}
                        placeholder="Ex: Conta de Luz ou Assinatura SaaS"
                        className="form-input focus-rose"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Categoria</label>
                        <select 
                          value={desCat}
                          onChange={(e) => setDesCat(e.target.value)}
                          className="form-select focus-rose"
                        >
                          <option value="Moradia">Moradia</option>
                          <option value="Alimentação">Alimentação</option>
                          <option value="Transporte">Transporte</option>
                          <option value="Saúde">Saúde</option>
                          <option value="Educação">Educação</option>
                          <option value="Lazer">Lazer</option>
                          <option value="Internet">Internet</option>
                          <option value="Celular">Celular</option>
                          <option value="Veículos">Veículos</option>
                          <option value="Compras">Compras</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Valor (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={desVal}
                          onChange={(e) => setDesVal(e.target.value)}
                          placeholder="0,00"
                          className="form-input focus-rose font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Vencimento</label>
                        <input 
                          type="date" 
                          value={desDate}
                          onChange={(e) => setDesDate(e.target.value)}
                          className="form-input focus-rose"
                        />
                      </div>
                      <div>
                        <label className="form-label">Método Pagamento</label>
                        <select 
                          value={desPay}
                          onChange={(e) => setDesPay(e.target.value)}
                          className="form-select focus-rose"
                        >
                          <option value="Pix">Pix</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Boleto">Boleto</option>
                          <option value="Débito">Débito</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Despesa Recorrente?</label>
                        <select 
                          value={desRecorrente}
                          onChange={(e) => setDesRecorrente(e.target.value)}
                          className="form-select focus-rose"
                        >
                          <option value="Sim">Sim (Lançar todo mês)</option>
                          <option value="Nao">Não (Lançamento Único)</option>
                        </select>
                      </div>
                      {desRecorrente === 'Sim' && (
                        <div>
                          <label className="form-label">Frequência</label>
                          <select 
                            value={desFreq}
                            onChange={(e) => setDesFreq(e.target.value)}
                            className="form-select focus-rose"
                          >
                            <option value="Mensal">Mensal</option>
                            <option value="Semanal">Semanal</option>
                            <option value="Anual">Anual</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit"
                      className="btn-full btn-rose"
                    >
                      Salvar Despesa
                    </button>
                  </form>
                </div>

                {/* LISTAGEM */}
                <div className={"p-6 app-card lg:col-span-2"}>
                  <h3 className="text-md font-bold mb-4">Saídas Registradas</h3>
                  <div className="space-y-3">
                    {despesas.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">Nenhum gasto lançado.</p>
                    ) : (
                      despesas.map((des) => (
                        <div key={des.id} className="flex items-center justify-between p-4 bg-slate-950/45 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                          <div>
                            <p className="font-semibold text-slate-100">{des.descricao}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-rose-950 text-rose-400 rounded text-[10px] font-medium uppercase">{des.categoria}</span>
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-medium">{des.pagamento}</span>
                              {des.recorrente === 'Sim' ? (
                                <span className="px-2 py-0.5 bg-rose-950/50 text-rose-300 border border-rose-500/30 rounded text-[10px] font-semibold">Recorrente: {des.frequencia || 'Mensal'}</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-[10px] font-semibold">Pontual</span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium">Vencimento: {des.data}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-rose-400">R$ {des.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <button 
                              onClick={() => deleteDespesa(des.id)}
                              className="btn-delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PARCELAMENTOS */}
          {activeTab === 'parcelamentos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-sky-400">Controle de Parcelamentos</h2>
                <p className="text-sm text-slate-400">Acompanhe suas compras parceladas de longo prazo e reduza o comprometimento.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORM COMPRA PARCELADA */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 text-sky-400 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Novo Parcelamento
                  </h3>
                  <form onSubmit={addParcelamento} className="space-y-4">
                    <div>
                      <label className="form-label">Nome da Dívida / Compra</label>
                      <input 
                        type="text" 
                        value={parName}
                        onChange={(e) => setParName(e.target.value)}
                        placeholder="Ex: Documento Carro"
                        className="form-input focus-sky"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Valor Total (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={parTotalVal}
                          onChange={(e) => setParTotalVal(e.target.value)}
                          placeholder="Ex: 2400"
                          className="form-input focus-sky font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Qtd. de Parcelas</label>
                        <input 
                          type="number" 
                          value={parQtd}
                          onChange={(e) => setParQtd(e.target.value)}
                          placeholder="Ex: 12"
                          className="form-input focus-sky font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Parcela Atual</label>
                        <input 
                          type="number" 
                          value={parAtual}
                          onChange={(e) => setParAtual(e.target.value)}
                          placeholder="Ex: 1"
                          className="form-input focus-sky"
                        />
                      </div>
                      <div>
                        <label className="form-label">Primeiro Vencimento</label>
                        <input 
                          type="date" 
                          value={parDate}
                          onChange={(e) => setParDate(e.target.value)}
                          className="form-input focus-sky"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="btn-full btn-sky"
                    >
                      Cadastrar Parcelamento
                    </button>
                  </form>
                </div>

                {/* VISUALIZADOR DE PARCELAMENTOS ATIVOS */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold">Planos de Parcelamento</h3>
                  {parcelamentos.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhum parcelamento ativo.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {parcelamentos.map((p) => {
                        const percentPago = parseFloat(((p.parcelaAtual / p.parcelasQtd) * 100).toFixed(0));

                        return (
                          <div key={p.id} className={"p-5 app-card flex flex-col justify-between"}>
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-md text-slate-200">{p.nome}</h4>
                                <span className="px-2.5 py-1 bg-slate-800 text-sky-400 border border-slate-700 rounded-lg text-xs font-bold">
                                  {p.parcelaAtual} / {p.parcelasQtd} parc.
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">Vence dia {p.dataVencimento || 'N/A'}</p>

                              {/* Barra de Progresso */}
                              <div className="w-full bg-slate-950 rounded-full h-2 mt-4 overflow-hidden border border-slate-800">
                                <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${percentPago}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
                                <span>{percentPago}% Pago</span>
                                <span>R$ {(p.parcelaAtual * p.valorParcela).toFixed(0)} de R$ {p.valorTotal.toFixed(0)}</span>
                              </div>
                            </div>

                            <div className="border-t border-slate-800/80 mt-4 pt-3 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Próxima Parcela</span>
                                <span className="text-md font-extrabold text-sky-400">R$ {p.valorParcela.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => avancarParcela(p)}
                                  className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500 hover:text-white border border-sky-500/20 text-sky-400 text-xs font-bold rounded-lg transition-all"
                                  title="Avançar uma parcela como paga"
                                >
                                  Pagar Parcela
                                </button>
                                <button 
                                  onClick={() => deleteParcelamento(p.id)}
                                  className="btn-ghost-delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: EMPRÉSTIMOS */}
          {activeTab === 'emprestimos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-amber-500">Módulo de Empréstimos Financiados</h2>
                <p className="text-sm text-slate-400">Controle taxas de juros, saldos devedores e simule quitações eficientes.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORM CONTRATAR */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 text-amber-500 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Registrar Empréstimo
                  </h3>
                  <form onSubmit={addEmprestimo} className="space-y-4">
                    <div>
                      <label className="form-label">Instituição Financeira</label>
                      <input 
                        type="text" 
                        value={empInst}
                        onChange={(e) => setEmpInst(e.target.value)}
                        placeholder="Ex: Banco do Brasil"
                        className="form-input focus-amber"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Valor Contratado</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={empVal}
                          onChange={(e) => setEmpVal(e.target.value)}
                          placeholder="R$ 17097,63"
                          className="form-input focus-amber font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Taxa de Juros (% a.m.)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={empJuros}
                          onChange={(e) => setEmpJuros(e.target.value)}
                          placeholder="Ex: 3.68"
                          className="form-input focus-amber font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Qtd. de Parcelas</label>
                        <input 
                          type="number" 
                          value={empQtd}
                          onChange={(e) => setEmpQtd(e.target.value)}
                          placeholder="Ex: 14"
                          className="form-input focus-amber"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Valor da Parcela (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={empParVal}
                          onChange={(e) => setEmpParVal(e.target.value)}
                          placeholder="Opcional (Auto)"
                          className="form-input focus-amber font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Data Inicial / Contratação</label>
                      <input 
                        type="date" 
                        value={empDateStart}
                        onChange={(e) => setEmpDateStart(e.target.value)}
                        className="form-input focus-amber"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="btn-full btn-amber"
                    >
                      Salvar Empréstimo
                    </button>
                  </form>
                </div>

                {/* LISTAGEM DE EMPRÉSTIMOS ATIVOS */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold">Contratos em Amortização</h3>
                  
                  {emprestimos.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhum empréstimo ativo no momento.</p>
                  ) : (
                    emprestimos.map((e) => {
                      const totalRestante = (e.parcelasQtd - e.parcelaAtual) * e.valorParcela;
                      const progressoPercent = Math.min(parseFloat(((e.parcelaAtual / e.parcelasQtd) * 100).toFixed(0)), 100);

                      return (
                        <div key={e.id} className={"p-6 app-card space-y-4"}>
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                              <h4 className="font-extrabold text-lg text-slate-100">{e.instituicao}</h4>
                              <p className="text-xs text-slate-400">Contrato iniciado em: {e.dataInicial}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold">
                                Juros: {e.taxaJuros}% a.m.
                              </span>
                              <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold">
                                Parcela {e.parcelaAtual} / {e.parcelasQtd}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                            <div>
                              <span className="text-xs text-slate-400 block">Valor Emprestado</span>
                              <span className="text-md font-bold text-slate-200">R$ {e.valorContratado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400 block">Valor da Parcela</span>
                              <span className="text-md font-bold text-amber-400">R$ {e.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-xs text-slate-400 block">Saldo Devedor Restante</span>
                              <span className="text-md font-bold text-rose-400">R$ {totalRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {/* Barra de Progresso de Pagamento */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-400">
                              <span>Progresso de Amortização</span>
                              <span>{progressoPercent}% Concluído</span>
                            </div>
                            <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2.5 overflow-hidden">
                              <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${progressoPercent}%` }} />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                            <button 
                              onClick={() => pagarParcelaEmprestimo(e)}
                              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition-all"
                            >
                              Registrar Pagamento de Parcela
                            </button>
                            <button 
                              onClick={() => deleteEmprestimo(e.id)}
                              className="btn-ghost-delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: IMPOSTO DE RENDA (IRPF) */}
          {activeTab === 'impostos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-400">Controle do Imposto de Renda (IRPF)</h2>
                <p className="text-sm text-slate-400">Monitore parcelas do IRPF devido do exercício atual para garantir conformidade legal.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORM REGISTRAR IMPOSTO */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 text-indigo-400 flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Registrar Declaração
                  </h3>
                  <form onSubmit={addImposto} className="space-y-4">
                    <div>
                      <label className="form-label">Título do Imposto / Ano</label>
                      <input 
                        type="text" 
                        value={impDesc}
                        onChange={(e) => setImpDesc(e.target.value)}
                        placeholder="Ex: IRPF 2026"
                        className="form-input focus-indigo"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Valor Total Devido (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={impTotal}
                          onChange={(e) => setImpTotal(e.target.value)}
                          placeholder="Ex: 7040"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Qtd. Parcelas</label>
                        <input 
                          type="number" 
                          value={impQtd}
                          onChange={(e) => setImpQtd(e.target.value)}
                          placeholder="Ex: 8"
                          className="form-input focus-indigo"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Parcelas Já Pagas</label>
                      <input 
                        type="number" 
                        value={impPagas}
                        onChange={(e) => setImpPagas(e.target.value)}
                        placeholder="Ex: 0"
                        className="form-input focus-indigo"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="btn-full btn-indigo"
                    >
                      Salvar IRPF
                    </button>
                  </form>
                </div>

                {/* LISTA DE DECLARAÇÕES E PROGRESSOS */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold">Impostos Devidos Ativos</h3>

                  {impostos.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhum imposto de renda pendente cadastrado.</p>
                  ) : (
                    impostos.map((imp) => {
                      const parcelasRestantes = imp.parcelasQtd - imp.parcelasPagas;
                      const totalRestante = parcelasRestantes * imp.valorParcela;
                      const pagasPercent = parseFloat(((imp.parcelasPagas / imp.parcelasQtd) * 100).toFixed(0));

                      return (
                        <div key={imp.id} className={"p-6 app-card space-y-4"}>
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-md font-extrabold text-indigo-400">{imp.descricao}</h4>
                              <p className="text-xs text-slate-400">Parcelamento Fiscal</p>
                            </div>
                            <span className="px-3 py-1 bg-indigo-950 text-indigo-300 rounded-lg text-xs font-semibold">
                              {imp.parcelasPagas} de {imp.parcelasQtd} cotas pagas
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                              <span className="text-xs text-slate-500 block">Total Devido</span>
                              <span className="font-semibold text-slate-200">R$ {imp.valorTotal.toLocaleString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 block">Cota Mensal</span>
                              <span className="font-semibold text-indigo-400">R$ {imp.valorParcela.toLocaleString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 block">Restante</span>
                              <span className="font-semibold text-rose-400">R$ {totalRestante.toLocaleString('pt-BR')}</span>
                            </div>
                          </div>

                          {/* Progresso Fiscal */}
                          <div className="space-y-1">
                            <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden">
                              <div className="bg-indigo-500 h-full" style={{ width: `${pagasPercent}%` }} />
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Progresso Fiscal</span>
                              <span>{pagasPercent}% Quitado</span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                            <button 
                              onClick={() => pagarParcelaImposto(imp)}
                              className="px-3.5 py-1.5 bg-indigo-500 text-white font-bold text-xs rounded-lg hover:bg-indigo-400 transition-all"
                            >
                              Pagar Cota/Parcela
                            </button>
                            <button 
                              onClick={() => deleteImposto(imp.id)}
                              className="btn-ghost-delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 7: SIMULADOR DE IMPACTO FINANCEIRO */}
          {activeTab === 'simulador' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-400">Simulador de Impacto Financeiro</h2>
                <p className="text-sm text-slate-400">Descubra como novas compras, empréstimos ou dívidas impactarão seu comprometimento de renda antes de assinar.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORM SIMULADOR */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 text-slate-200 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-400" />
                    Parâmetros da Simulação
                  </h3>
                  <form onSubmit={handleSimulacao} className="space-y-4">
                    <div>
                      <label className="form-label">Tipo da Simulação</label>
                      <select 
                        value={simType}
                        onChange={(e: any) => setSimType(e.target.value)}
                        className="form-select focus-indigo"
                      >
                        <option value="parcela">Compra Parcelada (Cartão/Lojas)</option>
                        <option value="emprestimo">Novo Empréstimo</option>
                        <option value="financiamento">Financiamento (Veículo/Imóvel)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Nome/Identificação da Compra</label>
                      <input 
                        type="text" 
                        value={simName}
                        onChange={(e) => setSimName(e.target.value)}
                        placeholder="Ex: Novo Smartphone"
                        className="form-input focus-indigo"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Valor do Bem (R$)</label>
                        <input 
                          type="number" 
                          value={simVal}
                          onChange={(e) => setSimVal(e.target.value)}
                          placeholder="Ex: 3500"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Qtd. de Parcelas</label>
                        <input 
                          type="number" 
                          value={simParc}
                          onChange={(e) => setSimParc(e.target.value)}
                          placeholder="Ex: 10"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 font-semibold"
                          required
                        />
                      </div>
                    </div>

                    {(simType === 'emprestimo' || simType === 'financiamento') && (
                      <div>
                        <label className="form-label">Juros ao Mês (% a.m.)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={simJuros}
                          onChange={(e) => setSimJuros(e.target.value)}
                          placeholder="Ex: 2.5"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>
                    )}

                    <button 
                      type="submit"
                      className="btn-full btn-indigo"
                    >
                      Simular Impacto
                    </button>
                  </form>
                </div>

                {/* RESULTADO DA SIMULAÇÃO */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold">Relatório Comparativo de Impacto</h3>

                  {simResultado ? (
                    <div className={"p-6 app-card space-y-6"}>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                          <span className="text-xs text-slate-400 uppercase font-bold">Resultado para:</span>
                          <h4 className="text-lg font-extrabold text-slate-100">{simResultado.nome}</h4>
                        </div>
                        <span className={`px-3 py-1 bg-indigo-950 ${simResultado.cor} rounded-lg text-xs font-extrabold uppercase`}>
                          Classificação: {simResultado.classificacao}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <span className="text-xs text-slate-400 block">Parcela Estimada</span>
                          <span className="text-xl font-bold text-indigo-400">R$ {simResultado.valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="text-[11px] text-slate-500 block mt-1">Durante {simResultado.parcelas} meses.</span>
                        </div>
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <span className="text-xs text-slate-400 block">Impacto no Saldo Mensal</span>
                          <span className={`text-xl font-bold ${simResultado.impactoSaldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            R$ {simResultado.impactoSaldo.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-1">Novo saldo do mês projetado.</span>
                        </div>
                      </div>

                      {/* COMPARAÇÃO DO COMPROMETIMENTO DA RENDA */}
                      <div className="space-y-4 p-4 bg-slate-950/30 rounded-xl border border-slate-800/50">
                        <h5 className="text-xs text-slate-300 font-bold uppercase tracking-wider">Comprometimento de Renda (%)</h5>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Comprometimento Atual</span>
                            <span className="font-bold">{simResultado.taxaAtual}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${simResultado.taxaAtual}%` }} />
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800/40">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Novo Comprometimento Simulada</span>
                            <span className={`font-extrabold ${simResultado.cor}`}>{simResultado.taxaFutura}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                            <div className={`${simResultado.taxaFutura > 40 ? 'bg-rose-500' : 'bg-indigo-500'} h-full`} style={{ width: `${simResultado.taxaFutura}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-3">
                        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-400 leading-relaxed">
                          <p className="font-bold text-slate-300 mb-1">Parecer Planner:</p>
                          {simResultado.taxaFutura > 40 ? (
                            <span>Este compromisso elevará consideravelmente seu risco financeiro pessoal, deixando sua liquidez escassa. Recomenda-se adiar a aquisição ou buscar parcelas menores.</span>
                          ) : (
                            <span>O acréscimo se mantém dentro de parâmetros saudáveis e não compromete excessivamente seu fluxo livre de caixa. Compra viável.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500">
                      Preencha os dados à esquerda para iniciar um comparativo de impacto.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 8: RESERVA DE EMERGÊNCIA */}
          {activeTab === 'reserva' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-emerald-400">Reserva de Emergência</h2>
                <p className="text-sm text-slate-400">Sua proteção financeira para imprevistos. O recomendado é possuir o equivalente a 6 meses do seu custo de vida básico.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* CONFIGURAÇÃO / AJUSTES */}
                <div className={"p-6 app-card lg:col-span-1"}>
                  <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    Metas & Poupança
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Meta Financeira Total (R$)</label>
                      <input 
                        type="number" 
                        value={reservaMeta}
                        onChange={(e) => saveReservaConfig(e.target.value, reservaAtual.toString(), reservaMensal.toString())}
                        className="form-input font-semibold"
                      />
                    </div>

                    <div>
                      <label className="form-label">Valor Acumulado Atual (R$)</label>
                      <input 
                        type="number" 
                        value={reservaAtual}
                        onChange={(e) => saveReservaConfig(reservaMeta.toString(), e.target.value, reservaMensal.toString())}
                        className="form-input font-semibold"
                      />
                    </div>

                    <div>
                      <label className="form-label">Aporte Mensal Previsto (R$)</label>
                      <input 
                        type="number" 
                        value={reservaMensal}
                        onChange={(e) => saveReservaConfig(reservaMeta.toString(), reservaAtual.toString(), e.target.value)}
                        className="form-input font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* PROGRESSO E ESTIMATIVAS */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold">Status da Reserva</h3>

                  {(() => {
                    const percentAlcancado = Math.min(parseFloat(((reservaAtual / reservaMeta) * 100).toFixed(1)), 100);
                    const restante = Math.max(reservaMeta - reservaAtual, 0);
                    const tempoEstimadoMeses = reservaMensal > 0 ? Math.ceil(restante / reservaMensal) : 0;

                    return (
                      <div className={"p-6 app-card space-y-6"}>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs text-slate-400 uppercase font-bold">Percentual Alcançado:</span>
                            <h4 className="text-2xl font-extrabold text-emerald-400">{percentAlcancado}%</h4>
                          </div>
                          <span className="px-3 py-1 bg-emerald-950 text-emerald-300 rounded-lg text-xs font-bold">
                            Restam R$ {restante.toLocaleString('pt-BR')}
                          </span>
                        </div>

                        {/* Progresso visual grande */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-4 overflow-hidden p-0.5">
                            <div className="bg-gradient-to-r from-emerald-600 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentAlcancado}%` }} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-400 block">Tempo Estimado para Meta</span>
                            <span className="text-xl font-extrabold text-emerald-400">
                              {tempoEstimadoMeses > 0 ? `${tempoEstimadoMeses} Meses` : 'Aporte zerado'}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">Considerando um aporte fixo de R$ {reservaMensal}/mês.</p>
                          </div>

                          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-400 block">Análise de Segurança</span>
                            <span className="text-md font-bold text-slate-200 block mt-1">
                              Sua reserva protege {Math.min(parseFloat((reservaAtual / (totalDespesas || 1)).toFixed(1)), 12)} meses
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">com base no seu custo de vida atual de R$ {totalDespesas.toFixed(0)}/mês.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>
          )}

          {/* TAB 9: DIAGNÓSTICO INTELIGENTE */}
          {activeTab === 'diagnostico' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-fuchsia-400 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                  Diagnóstico Financeiro Profundo
                </h2>
                <p className="text-sm text-slate-400">Descubra seu nível de saúde financeira com base no endividamento geral, capacidade de poupança e sugestões integradas.</p>
              </div>

              <div className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800 text-center">
                <p className="text-slate-300 text-sm max-w-lg mx-auto mb-4">
                  Nossa inteligência financeira interna consolida e analisa suas receitas, passivos, empréstimos e impostos para gerar um diagnóstico completo e plano de ação.
                </p>
                <button 
                  onClick={rodarDiagnostico}
                  disabled={isAnalisando}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-fuchsia-600 text-white font-bold rounded-xl transition-all shadow-xl hover:opacity-90 disabled:opacity-50"
                >
                  {isAnalisando ? 'Analisando Suas Finanças...' : 'Analisar Minhas Finanças'}
                </button>
              </div>

              {analiseResultado && (
                <div className={`p-6 rounded-2xl border bg-gradient-to-b ${analiseResultado.corFundo} space-y-6 transition-all duration-300`}>
                  
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-4 gap-2">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-bold">Resultado gerado em {analiseResultado.dataAnalise}</span>
                      <h3 className={`text-xl font-extrabold ${analiseResultado.corTexto}`}>Saúde Financeira: {analiseResultado.nivel}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">Classificação Geral</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60">
                      <span className="text-xs text-slate-400 block">% de Endividamento de Longo Prazo</span>
                      <span className="text-lg font-bold text-indigo-400">{analiseResultado.taxaEndividamento}%</span>
                      <p className="text-[10px] text-slate-500 mt-1">Dívida acumulada sobre receita anual estimada.</p>
                    </div>

                    <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60">
                      <span className="text-xs text-slate-400 block">Capacidade Líquida de Poupança</span>
                      <span className={`text-lg font-bold ${analiseResultado.capPagamento >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        R$ {analiseResultado.capPagamento.toLocaleString('pt-BR')}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">Saldo livre real gerado após amortizar parcelas.</p>
                    </div>

                    <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60">
                      <span className="text-xs text-slate-400 block">Recomendado para Reserva</span>
                      <span className="text-lg font-bold text-sky-400">R$ {analiseResultado.recomendadoReserva.toLocaleString('pt-BR')}</span>
                      <p className="text-[10px] text-slate-500 mt-1">Cálculo de cobertura básica de 6 meses de gastos.</p>
                    </div>
                  </div>

                  {/* SUGESTÕES DE ECONOMIA */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">Recomendações e Plano de Ação Personalizado:</h4>
                    <div className="space-y-2">
                      {analiseResultado.sugestoes.map((sugestao, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/50">
                          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-300 leading-relaxed">{sugestao}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 10: RELATÓRIOS COMPLETOS */}
          {activeTab === 'relatorios' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Relatórios e Exportações</h2>
                  <p className="text-sm text-slate-400">Exporte ou imprima seu relatório completo consolidado de 2026.</p>
                </div>
                <button 
                  onClick={exportarDados}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Relatório (JSON)</span>
                </button>
              </div>

              {/* CONSOLIDAÇÃO VISUAL DO RELATÓRIO COMPLETO */}
              <div className={"p-6 app-card space-y-6"}>
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold">Consolidação Anual Simulada</h3>
                    <p className="text-xs text-slate-400">Ativos, passivos e saldo de caixa do período atual de monitoramento.</p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Finance Planner Pro</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    <span className="text-xs text-slate-500 block uppercase font-bold">Receitas Totais</span>
                    <span className="text-md font-bold text-emerald-400">R$ {totalReceitas.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    <span className="text-xs text-slate-500 block uppercase font-bold">Custo Fixo/Variável</span>
                    <span className="text-md font-bold text-rose-400">R$ {totalDespesas.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    <span className="text-xs text-slate-500 block uppercase font-bold">Dívidas Este Mês</span>
                    <span className="text-md font-bold text-indigo-400">R$ {totalDividasEsteMes.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    <span className="text-xs text-slate-500 block uppercase font-bold">Passivo Consolidado</span>
                    <span className="text-md font-bold text-rose-500">R$ {dividaTotalRestante.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-sm font-bold mb-3">Detalhamento de Entradas Registradas</h4>
                  <div className="space-y-2">
                    {receitas.map((r, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-400">
                        <span>{r.descricao} - {r.categoria} ({r.recorrente === 'Sim' ? 'Mensal' : 'Fixo'})</span>
                        <span className="font-semibold text-slate-300">R$ {r.valor.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-sm font-bold mb-3">Detalhamento de Saídas e Despesas</h4>
                  <div className="space-y-2">
                    {despesas.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-400">
                        <span>{d.descricao} - {d.categoria} ({d.recorrente === 'Sim' ? 'Recorrente' : 'Fixo'})</span>
                        <span className="font-semibold text-slate-300">R$ {d.valor.toFixed(2)}</span>
                      </div>
                    ))}
                    {parcelamentos.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-400">
                        <span>{p.nome} - Parcela {p.parcelaAtual}/{p.parcelasQtd}</span>
                        <span className="font-semibold text-indigo-400">R$ {p.valorParcela.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: AUTENTICAÇÃO */}
          {activeTab === 'auth' && (
            <div className="max-w-md mx-auto my-12 space-y-6">
              <div className={"p-6 app-card"}>
                <h3 className="text-lg font-bold mb-2 text-center text-emerald-400">Acesse sua Conta</h3>
                <p className="text-xs text-slate-400 text-center mb-6">Sincronize seus dados financeiros na nuvem com segurança.</p>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {isRegistering && (
                    <div>
                      <label className="form-label">Nome Completo</label>
                      <input 
                        type="text" 
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Ex: Roberto Silva"
                        className="form-input"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="form-label">E-mail</label>
                    <input 
                      type="email" 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="roberto@planner.com"
                      className="form-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Senha</label>
                    <input 
                      type="password" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg"
                  >
                    {isRegistering ? 'Criar Conta' : 'Fazer Login'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button 
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-xs text-indigo-400 hover:underline font-semibold"
                  >
                    {isRegistering ? 'Já possui conta? Faça Login' : 'Não tem conta? Cadastre-se'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* --- RODAPÉ --- */}
      <footer className={`py-6 border-t text-center text-xs ${darkMode ? 'bg-slate-950 border-slate-900 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
        <p>© 2026 Finance Planner Pro. Todos os direitos reservados. Desenvolvido por <a href="https://karythongomes.com.br" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline"><strong>GomesTechnology.</strong></a></p>
      </footer>

    </div>
  );
}