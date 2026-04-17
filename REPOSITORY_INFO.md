# 📁 Repository Information

> **IMPORTANT: This file contains critical repository information. DO NOT DELETE.**

---

## 🔐 GitHub Configuration

| Property | Value |
|----------|-------|
| **Repository** | https://github.com/chiranjitk/StaySuite-HospitalityOS.git |
| **Branch** | main (NOT master) |
| **Author** | chiranjitk |
| **Email** | chiranjitk@outlook.com |
| **Token** | Use `GITHUB_TOKEN` from `.env` file |

---

## 📋 Git Setup Commands (Run on every session)

```bash
git config user.name "chiranjitk"
git config user.email "chiranjitk@outlook.com"
git remote set-url origin https://github.com/chiranjitk/StaySuite-HospitalityOS.git
```

---

## 🔄 Sync Protocol

### Before Starting Work:
```bash
git fetch origin
git status
git log HEAD..origin/main --oneline  # Check if behind
git log origin/main..HEAD --oneline  # Check if ahead
```

### After Completing Work:
```bash
git add -A
git commit -m "[descriptive message]"
git push origin main
```

---

## 📌 Branch Strategy

- **main**: Production-ready code only
- **Never use master branch**
- **Always verify branch**: `git branch --show-current`

---

## 🚨 Critical Rules

1. **Commit and push after EVERY task**
2. **Verify commit on GitHub before saying "done"**
3. **Compare local vs remote before making decisions**
4. **Never force push without backup**
5. **Never commit secrets or tokens to repository**

---

## 📊 Status Check Command

```bash
# Quick status check
git status && echo "---" && git log --oneline -3
```

---

## 🏨 Project Information

- **Project**: StaySuite HospitalityOS
- **Type**: Multi-Tenant SaaS Platform
- **Modules**: 24+ integrated modules
- **OTA Integrations**: 48+ channels
- **Tech Stack**: Next.js 16, TypeScript, Prisma, SQLite, Tailwind CSS

---

**Last Updated:** 2026-03-28
