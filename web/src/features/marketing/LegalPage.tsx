import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

interface LegalPageProps {
  kind: 'terms' | 'privacy'
}

const updatedAt = '31 de outubro de 2026'

export function LegalPage({ kind }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between bg-ink px-5 py-3 text-paper">
        <Link className="font-black tracking-widest" to="/"><strong className="text-brand-light">MEU</strong> BARBEIRO</Link>
        <Link className="flex items-center gap-1 text-xs font-bold" to="/"><ArrowLeft aria-hidden="true" className="size-4" /> Voltar ao site</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 text-[.92rem] leading-relaxed text-ink/85 [&_h1]:mb-2 [&_h1]:font-serif [&_h1]:text-4xl [&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
        {kind === 'terms' ? <Terms /> : <Privacy />}
      </main>
      <footer className="flex justify-center gap-6 border-t border-line py-8 text-xs text-muted">
        <Link to="/termos">Termos de uso</Link>
        <Link to="/privacidade">Privacidade e LGPD</Link>
      </footer>
    </div>
  )
}

function Terms() {
  return (
    <article>
      <p className="text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">Documento legal</p>
      <h1>Termos de uso</h1>
      <p className="text-xs text-muted">Última atualização: {updatedAt}</p>

      <h2>1. O que é o Meu Barbeiro</h2>
      <p>O Meu Barbeiro é um software como serviço (SaaS) para gestão de barbearias: agenda, catálogo de serviços, equipe, pagamentos, lembretes e relatórios. Ao criar uma conta ou usar a plataforma, você concorda com estes termos. Se não concordar, não use o serviço.</p>

      <h2>2. Contas e responsabilidade</h2>
      <ul>
        <li>Quem cria a barbearia é o titular da conta e responde pelas informações cadastradas, pelo uso da equipe e pelo cumprimento das obrigações fiscais do seu negócio.</li>
        <li>O acesso é pessoal. O titular deve manter a senha e o e-mail de login seguros e remover imediatamente o acesso de quem deixar a equipe.</li>
        <li>Menores de 18 anos só podem usar a plataforma com representação legal.</li>
      </ul>

      <h2>3. Teste grátis e planos</h2>
      <p>Toda barbearia nova começa com 14 dias de teste, sem cobrança e sem cartão. Ao final do teste, a edição de serviços, equipe e configurações fica bloqueada até a contratação de um plano. A página pública e os dados continuam preservados; nada é apagado por inadimplência.</p>
      <p>Os planos Essencial, Profissional e Escala têm limites de profissionais e de unidades descritos na página de preços. A contratação é mensal ou anual, cobrada via Mercado Pago, e pode ser cancelada a qualquer momento na tela de assinatura.</p>

      <h2>4. Pagamentos e comissão</h2>
      <ul>
        <li>A mensalidade é cobrada antecipadamente pelo Mercado Pago. O ciclo anual concede dois meses de desconto.</li>
        <li>Além da mensalidade, a plataforma retém 1% do valor de cada serviço pago online pelo cliente final, descontado no momento da transação.</li>
        <li>O sinal pago pelo cliente final entra na conta Mercado Pago da barbearia. O Meu Barbeiro não custodiza esse dinheiro.</li>
        <li>Estornos de sinal seguem a política de cancelamento configurada pela própria barbearia.</li>
      </ul>

      <h2>5. Cancelamento e reembolso</h2>
      <p>O cancelamento vale para o ciclo seguinte e não gera multa. Não há reembolso proporcional de período já iniciado, salvo obrigação legal. Em caso de cobrança indevida, escreva para suporte@meubarbeiro.app em até 30 dias.</p>

      <h2>6. Uso aceitável</h2>
      <p>É proibido usar a plataforma para enviar mensagens não solicitadas, cadastrar dados de terceiros sem base legal, tentar acessar barbearias ou dados de outros usuários, ou revender o software sem autorização escrita. O descumprimento pode levar à suspensão da conta.</p>

      <h2>7. Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço disponível, mas não garantimos operação ininterrupta. Não respondemos por lucros cessantes decorrentes de indisponibilidade, falha de internet do usuário ou de terceiros como Mercado Pago e Google.</p>

      <h2>8. Propriedade intelectual</h2>
      <p>O software, a marca e o código são da plataforma. Os dados da barbearia (clientes, agenda, valores) pertencem à barbearia. Você pode exportar os relatórios financeiros enquanto a conta estiver ativa.</p>

      <h2>9. Encerramento</h2>
      <p>Você pode encerrar a conta quando quiser. Podemos encerrar contas que violem estes termos, com aviso prévio quando a lei exigir. Após o encerramento, os dados são mantidos pelo prazo legal aplicável e depois eliminados.</p>

      <h2>10. Foro e lei aplicável</h2>
      <p>Estes termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor para reclamações de consumo e o foro da sede da plataforma para as demais controvérsias.</p>
    </article>
  )
}

function Privacy() {
  return (
    <article>
      <p className="text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">Documento legal</p>
      <h1>Política de privacidade</h1>
      <p className="text-xs text-muted">Última atualização: {updatedAt} · Em conformidade com a LGPD (Lei 13.709/2018)</p>

      <h2>1. Quem controla os dados</h2>
      <p>A barbearia é a controladora dos dados dos seus clientes (nome, telefone, histórico de atendimento, preferências e observações). O Meu Barbeiro atua como operador: trata esses dados apenas para prestar o serviço contratado. Para dados de cadastro da barbearia e de faturamento, a plataforma é a controladora.</p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li><b>Conta:</b> nome, e-mail, telefone e identificador do login Google.</li>
        <li><b>Barbearia:</b> nome, endereço, horários, equipe, serviços e configurações de pagamento.</li>
        <li><b>Clientes da barbearia:</b> nome, telefone, histórico de agendamentos, preferências, alergias e observações inseridas pela equipe.</li>
        <li><b>Pagamentos:</b> identificadores de transação e status do Mercado Pago. Não armazenamos número de cartão.</li>
        <li><b>Uso:</b> registros técnicos de acesso (IP, data, rota, identificador de requisição) para segurança e diagnóstico.</li>
      </ul>

      <h2>3. Bases legais</h2>
      <ul>
        <li><b>Execução de contrato:</b> operar agenda, cobrança e suporte.</li>
        <li><b>Legítimo interesse:</b> segurança, prevenção a fraude e melhoria do produto.</li>
        <li><b>Consentimento:</b> lembretes e comunicações opcionais, quando exigido.</li>
        <li><b>Obrigação legal:</b> guarda de registros fiscais e de acesso.</li>
      </ul>

      <h2>4. Compartilhamento</h2>
      <p>Não vendemos dados. Compartilhamos apenas o necessário com operadores: Google (autenticação), Mercado Pago (assinatura, sinal e comissão), provedor de e-mail (convites e avisos transacionais) e infraestrutura de hospedagem. Transferências internacionais, quando ocorrerem, seguem cláusulas contratuais e a LGPD.</p>

      <h2>5. Retenção</h2>
      <p>Dados de agenda e atendimento ficam enquanto a conta existir. Registros financeiros são mantidos por 5 anos por obrigação fiscal. Logs técnicos ficam por até 6 meses. Depois dos prazos, os dados são eliminados ou anonimizados.</p>

      <h2>6. Direitos do titular</h2>
      <p>Qualquer pessoa pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade e eliminação dos seus dados, além de revogar consentimento. Clientes devem procurar a barbearia, que é a controladora; a plataforma apoia a barbearia no atendimento em até 15 dias. Contato do encarregado de dados (DPO): privacidade@meubarbeiro.app.</p>

      <h2>7. Segurança</h2>
      <ul>
        <li>Sessões assinadas, cookies <code>HttpOnly</code> e <code>SameSite</code>.</li>
        <li>Tokens do Mercado Pago criptografados em repouso.</li>
        <li>Isolamento por barbearia em todas as consultas e autorização por papel.</li>
        <li>Registro de auditoria para ações sensíveis de equipe e de plataforma.</li>
        <li>Limitação de tentativas de login e de cadastro.</li>
      </ul>
      <p>Nenhum sistema é infalível. Em caso de incidente relevante, a plataforma comunica a ANPD e os titulares afetados nos prazos legais.</p>

      <h2>8. Cookies</h2>
      <p>Usamos apenas cookie essencial de sessão. Não usamos cookie de publicidade nem rastreador de terceiros. Por isso não há banner de consentimento.</p>

      <h2>9. Alterações</h2>
      <p>Mudanças materiais nesta política são avisadas por e-mail ou na própria plataforma com antecedência mínima de 15 dias.</p>
    </article>
  )
}
