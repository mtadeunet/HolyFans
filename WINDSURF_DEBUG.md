# 🚀 WindSurf Development Runners

This setup provides comprehensive development and debugging capabilities for your HolyFans Next.js application in WindSurf.

## 📋 Available Tasks

### 🛠️ Development Tasks
Access these via **Terminal > Run Task...** or **Ctrl+Shift+P > Tasks: Run Task**

| Task | Description | Usage |
|------|-------------|-------|
| **Start Development Server** | Launch Next.js dev server with hot reload | Daily development |
| **Build for Production** | Build static export for deployment | Before deployment |
| **Run Type Check** | TypeScript type checking only | Code quality checks |
| **Lint Code** | ESLint code quality check | Pre-commit checks |
| **Serve Static Build** | Serve built static files locally | Preview production build |
| **Clean Build** | Remove .next and out directories | Fresh start |
| **Install Dependencies** | Install/update npm packages | After package changes |

## 🐛 Debug Configurations

Access these via **Run and Debug** panel (Ctrl+Shift+D)

### Server-Side Debugging
| Configuration | Purpose | When to Use |
|---------------|---------|-------------|
| **Debug Development Server** | Debug Next.js server-side code | API routes, SSR issues |
| **Debug Build Process** | Debug static build generation | Build failures |
| **Debug TypeScript** | Type checking with debug info | Complex type issues |
| **Attach to Running Next.js** | Connect to already running server | Hot-reload debugging |

### Client-Side Debugging
| Configuration | Purpose | When to Use |
|---------------|---------|-------------|
| **Debug Client-Side (Chrome)** | Debug React components in browser | UI/UX issues |
| **Debug Static Build** | Debug production build locally | Production issues |

## 🎯 Quick Start Guide

### 1. **Start Development**
```bash
# Via WindSurf: Run Task > "Start Development Server"
# Or via terminal:
npm run dev
```

### 2. **Debug Server-Side Issues**
1. Set breakpoints in your code
2. Go to Run and Debug panel
3. Select "Debug Development Server"
4. Press F5 to start debugging

### 3. **Debug Client-Side Issues**
1. Set breakpoints in React components
2. Go to Run and Debug panel
3. Select "Debug Client-Side (Chrome)"
4. Press F5 to start debugging

### 4. **Test Production Build**
```bash
# Via WindSurf: Run Task > "Build for Production"
# Then: Run Task > "Serve Static Build"
# Or via terminal:
npm run build && npx serve -s out -l 3000
```

## 🔧 Key Features

### **Smart Problem Detection**
- Automatic TypeScript error detection
- ESLint integration for code quality
- Build error highlighting
- Real-time error reporting

### **Hot Reload Support**
- Development server auto-restarts on file changes
- Browser refreshes automatically
- Debug sessions persist across reloads

### **Static Build Testing**
- Test production builds locally
- Debug static export issues
- Preview GitHub Pages deployment

### **Integrated Terminal**
- All tasks run in integrated terminals
- Clear output formatting
- Easy to stop/restart tasks

## 🎨 Code Quality Integration

### **Format on Save**
- Automatic code formatting
- Import organization
- ESLint auto-fix

### **Tailwind CSS Support**
- Class name autocomplete
- Hover previews for styles
- Custom class regex support

### **TypeScript Features**
- IntelliSense for all imports
- Auto-import suggestions
- Type checking on the fly

## 📁 File Structure

```
.vscode/
├── tasks.json      # Build and development tasks
├── launch.json     # Debug configurations  
├── settings.json   # Editor settings
└── extensions.json # Recommended extensions
```

## 🔍 Debugging Tips

### **Server-Side Debugging**
- Use `console.log()` for quick debugging
- Set breakpoints in API routes
- Check `params` handling in dynamic routes
- Debug `generateStaticParams()` issues

### **Client-Side Debugging**
- Use React DevTools alongside WindSurf debugger
- Set breakpoints in useEffect hooks
- Debug state management issues
- Check hydration mismatches

### **Build Debugging**
- Check static export configuration
- Verify `output: 'export'` in next.config.js
- Debug `generateStaticParams()` for SSG
- Test asset loading issues

## 🚨 Common Issues & Solutions

### **Port Conflicts**
- Dev server uses port 3001 (3000 often occupied)
- Static build serves on port 3000
- Use `lsof -i :3000` to check port usage

### **Breakpoints Not Working**
- Ensure source maps are enabled
- Check `skipFiles` configuration
- Verify correct debug configuration selected

### **Hot Reload Issues**
- Restart development server
- Check for syntax errors
- Clear .next cache: `rm -rf .next`

### **Static Build Issues**
- Check `dynamic = 'force-static'` directives
- Verify no `headers()` calls
- Test with minimal page first

## 🎯 Best Practices

1. **Use appropriate debug configuration** for your issue type
2. **Clean build regularly** to avoid cache issues
3. **Test static builds** before deployment
4. **Use type checking** to catch issues early
5. **Set breakpoints strategically** to avoid excessive stops

## 🔄 Workflow Example

```bash
# 1. Start development
Run Task > "Start Development Server"

# 2. Debug server issue
Set breakpoints > Run > "Debug Development Server"

# 3. Test production build  
Run Task > "Build for Production"
Run Task > "Serve Static Build"

# 4. Debug client issue
Set breakpoints > Run > "Debug Client-Side (Chrome)"
```

## 📞 Getting Help

- **WindSurf Documentation**: Built-in help
- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Chrome DevTools**: F12 in browser

---

**Happy Debugging! 🎉**
