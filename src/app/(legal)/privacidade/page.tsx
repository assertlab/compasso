import Link from "next/link";
import { LEGAL_PATHS, MIN_AGE, PROCESSORS, RESPONSIBLE, SERVICE_NAME } from "@/lib/legal";
import { ContactLink, LegalDoc, P, Section, Ul } from "../legal-doc";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      summary={
        <p>
          Em poucas palavras: guardamos o que você precisa para registrar horas (e-mail, nome, seus registros e cadastros) e o mínimo para manter o acesso seguro. Não vendemos dados, não temos anúncios nem ferramentas de rastreamento. Você pode baixar
          os seus dados e excluir a sua conta sozinho, em <strong>Minha conta</strong>.
        </p>
      }
    >
      <Section title="1. Quem é o responsável">
        <P>
          O {SERVICE_NAME} é operado pelo {RESPONSIBLE}, que decide como os dados pessoais são tratados (o controlador, na Lei Geral de Proteção de Dados, a LGPD). O grupo é um grupo de pesquisa e não tem pessoa jurídica própria, e não há encarregado
          (DPO) designado: o canal para qualquer assunto sobre os seus dados é <ContactLink subject="Dados pessoais no Compasso" />. O serviço está em beta fechado, sem fins lucrativos, para pessoas convidadas.
        </P>
      </Section>

      <Section title="2. Quais dados tratamos">
        <Ul>
          <li>
            <strong>Conta:</strong> e-mail, nome (que você informa no primeiro acesso ou que vem do Google ou do GitHub, se você entrar por eles), o endereço da foto de perfil, se o provedor informar, e o seu fuso horário.
          </li>
          <li>
            <strong>O que você registra:</strong> clientes, projetos, tarefas e tags que você cadastra, e os registros de horas (início, término, fuso, descrição, tags e se são faturáveis). Você decide o que escrever nas descrições: evite dados pessoais
            de terceiros.
          </li>
          <li>
            <strong>Acesso e segurança:</strong> a sessão que mantém você conectado (com o endereço IP e o navegador usados no login), os códigos de verificação enviados por e-mail (guardados só como hash, com validade curta) e contadores de tentativas
            para limitar abuso (ligados a um hash do e-mail). Os registros técnicos de funcionamento da hospedagem podem conter endereço IP.
          </li>
          <li>
            <strong>Login com Google ou GitHub:</strong> usamos esses provedores só para confirmar quem você é e pedimos apenas e-mail e perfil básico. Não guardamos as chaves de acesso que eles fornecem e não consultamos outros dados seus neles.
          </li>
        </Ul>
        <P>Não coletamos dados pessoais sensíveis de propósito, não usamos localização, não acessamos sua câmera nem seu microfone.</P>
      </Section>

      <Section title="3. Para que usamos, e com que base">
        <Ul>
          <li>
            <strong>Fazer o serviço funcionar:</strong> identificar você, guardar os seus registros, montar relatórios, enviar códigos e convites. Base: execução do serviço que você pediu ao se cadastrar.
          </li>
          <li>
            <strong>Segurança e prevenção de abuso:</strong> limites de tentativas, verificação anti-robô e a lista de acesso do beta. Base: legítimo interesse em proteger o serviço e as pessoas que o usam.
          </li>
          <li>
            <strong>Cumprir a lei</strong>, quando houver obrigação legal ou ordem de autoridade.
          </li>
        </Ul>
        <P>Não usamos os dados para publicidade, não criamos perfis de comportamento e não vendemos nem alugamos dados a ninguém.</P>
      </Section>

      <Section title="4. Quem vê os seus dados">
        <P>
          <strong>Outras pessoas do workspace.</strong> Quem participa do mesmo workspace vê o seu nome e e-mail na lista de membros, e os administradores podem ver, corrigir e exportar os seus registros de horas ali, conforme as permissões. Seus dados de
          outros workspaces não aparecem para eles.
        </P>
        <P>
          <strong>Fornecedores que operam o serviço.</strong> Para funcionar, o {SERVICE_NAME} usa as empresas abaixo, que tratam dados em nosso nome:
        </P>
        <Ul>
          {PROCESSORS.map((processor) => (
            <li key={processor.name}>
              <strong>{processor.name}:</strong> {processor.purpose} <span className="text-muted-foreground">({processor.where}.)</span>
            </li>
          ))}
        </Ul>
        <P>Além disso, só compartilhamos dados se a lei ou uma decisão de autoridade exigir.</P>
      </Section>

      <Section title="5. Dados fora do Brasil">
        <P>
          Os fornecedores acima tratam dados fora do Brasil, em especial nos Estados Unidos. Esse tratamento acontece sob os termos de proteção de dados que cada fornecedor publica para seus clientes. Ao usar o serviço, você fica ciente dessa transferência
          internacional.
        </P>
      </Section>

      <Section title="6. Por quanto tempo guardamos, e o que acontece quando você exclui a conta">
        <Ul>
          <li>Enquanto a conta existir, guardamos os dados para o serviço funcionar. As sessões têm prazo, e os códigos de verificação valem por pouco tempo.</li>
          <li>
            Ao <strong>excluir a conta</strong> (Minha conta), o seu acesso termina na hora e apagamos os dados de acesso: sessões, vínculos de login e códigos. O seu nome e o seu e-mail são removidos e substituídos por um marcador anônimo.
          </li>
          <li>
            Os <strong>registros de horas permanecem</strong> no workspace, atribuídos a “Usuário removido”, para que relatórios já fechados não mudem. Textos que você escreveu nas descrições continuam lá e podem conter dados pessoais seus. Workspaces em
            que você era a única pessoa são arquivados, ou seja, ficam inacessíveis, mas o conteúdo continua guardado de forma anônima. Se quiser que isso também seja apagado, peça em <ContactLink subject="Eliminação de dados no Compasso" />.
          </li>
          <li>O banco de dados e a hospedagem mantêm cópias de segurança e registros técnicos por um tempo limitado, definido por esses fornecedores.</li>
        </Ul>
      </Section>

      <Section title="7. Seus direitos">
        <P>
          Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, o acesso a eles, a correção de dados incompletos ou errados, a anonimização, o bloqueio ou a eliminação do que for desnecessário ou excessivo, a portabilidade, a informação sobre
          com quem os compartilhamos e a revogação do consentimento, quando ele for a base. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
        <Ul>
          <li>
            <strong>Sem precisar nos escrever:</strong> em <strong>Minha conta</strong> você baixa os seus dados em JSON e exclui a conta.
          </li>
          <li>
            <strong>Para o resto:</strong> escreva para <ContactLink subject="Direitos de titular no Compasso" />. Podemos pedir que você confirme a sua identidade antes de atender.
          </li>
        </Ul>
      </Section>

      <Section title="8. Cookies e armazenamento no seu aparelho">
        <Ul>
          <li>Um cookie de sessão, necessário para manter você conectado. Sem ele não há login.</li>
          <li>A sua escolha de tema (claro, escuro ou do sistema), guardada no próprio navegador.</li>
          <li>A verificação anti-robô da Cloudflare, que pode usar armazenamento próprio durante a entrada.</li>
          <li>O aplicativo instalável (PWA) guarda em cache apenas arquivos públicos e a tela “Sem conexão”; nenhum dado seu.</li>
        </Ul>
        <P>Não usamos cookies de publicidade nem ferramentas de análise ou rastreamento.</P>
      </Section>

      <Section title="9. Idade mínima">
        <P>O serviço é para pessoas com {MIN_AGE} anos ou mais. Se você acha que uma pessoa mais nova criou uma conta, avise o contato para que ela seja excluída.</P>
      </Section>

      <Section title="10. Segurança">
        <P>
          Adotamos medidas como conexão cifrada, códigos guardados só como hash, limite de tentativas, verificação anti-robô, isolamento dos dados entre workspaces e controle de acesso por função. Nenhum sistema é totalmente seguro. Se houver um incidente que
          possa causar risco relevante a você, avisaremos as pessoas afetadas e a ANPD, quando a lei exigir.
        </P>
      </Section>

      <Section title="11. Mudanças nesta política">
        <P>
          A versão e a data ficam no topo desta página e na tela de entrada. Mudanças importantes serão avisadas no aplicativo ou por e-mail. Os{" "}
          <Link href={LEGAL_PATHS.terms} className="underline underline-offset-4">
            Termos de Uso
          </Link>{" "}
          complementam esta política.
        </P>
      </Section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Estes textos foram escritos em linguagem simples para o beta fechado e ainda não passaram por revisão jurídica. Serão revisados antes de qualquer abertura pública do serviço.
      </p>
    </LegalDoc>
  );
}
