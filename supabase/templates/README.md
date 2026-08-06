# 📧 Templates de E-mail Personalizados do Supabase Auth

Este diretório contém os templates HTML estilizados com a identidade visual do **Easy English** (tema escuro elegante, logo em gradiente e botão de alta conversão) para substituição dos e-mails padrão em inglês do Supabase.

---

## 🛠️ Como configurar no Painel do Supabase

1. Acesse o seu painel do Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione o seu projeto do **Easy English**.
3. No menu lateral esquerdo, vá em **Authentication** &rarr; **Email Templates**.
4. Para cada tipo de e-mail listado abaixo, cole o **Assunto (Subject)** sugerido e o conteúdo HTML correspondente.

---

### 1. Confirmação de E-mail (Confirm Signup)
- **Assunto (Subject):** `Confirme seu e-mail · Easy English`
- **Arquivo HTML:** [`confirm-email.html`](./confirm-email.html)

---

### 2. Redefinição de Senha (Reset Password)
- **Assunto (Subject):** `Redefinição de senha · Easy English`
- **Arquivo HTML:** [`reset-password.html`](./reset-password.html)

---

### 3. Link Mágico de Acesso (Magic Link)
- **Assunto (Subject):** `Seu link de acesso · Easy English`
- **Arquivo HTML:** [`magic-link.html`](./magic-link.html)

---

### 4. Mudança de E-mail (Change Email Address)
- **Assunto (Subject):** `Confirme a alteração do seu e-mail · Easy English`
- **Arquivo HTML:** [`change-email.html`](./change-email.html)

---

### 5. Convite de Usuário (User Invite)
- **Assunto (Subject):** `Você foi convidado para o Easy English`
- **Arquivo HTML:** [`invite-user.html`](./invite-user.html)

---

### 6. Reautenticação (Reauthentication)
- **Assunto (Subject):** `Seu código de verificação · Easy English`
- **Arquivo HTML:** [`reauthentication.html`](./reauthentication.html)

---

## 🎨 Características do Design

- **Responsividade total:** Compatível com Gmail, Outlook, Apple Mail e leitores de e-mail mobile.
- **Identidade da Marca:** Cores oficiais (`#FF5226` / `#E91E63`), tipografia moderna e visual premium.
- **Fallbacks de Segurança:** Botão destacado + caixa de cópia direta da URL `{{ .ConfirmationURL }}` para garantir o clique em qualquer cliente de e-mail.
