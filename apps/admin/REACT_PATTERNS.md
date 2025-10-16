# React Anti-Patterns Fixed in Admin Panel

## 1. Setting State During Render ❌ → useEffect ✅

### Anti-Pattern (CRITICAL)

```tsx
// ❌ BAD: setState during render causes infinite loops
const { data } = useQuery({ ... });

if (data && !formData.instance_name) {
  setFormData(data);           // Triggers re-render
  setCorsInput(data.cors_origins?.join(', ') || '');  // Triggers re-render
}
```

**Problems:**

- Causes unpredictable re-renders
- Can create infinite render loops
- Violates React's rendering rules
- Hard to debug

**React Error (in StrictMode):**

```
Warning: Cannot update a component while rendering a different component.
```

### Correct Pattern ✅

```tsx
// ✅ GOOD: Side effects in useEffect
const { data } = useQuery({ ... });

useEffect(() => {
  if (data) {
    setFormData(data);
    setCorsInput(data.cors_origins?.join(', ') || '');
  }
}, [data]); // Only runs when data changes
```

**Benefits:**

- Predictable behavior
- Runs after render (no blocking)
- Proper dependency tracking
- No infinite loops

---

## 2. Not Resetting Form After Success ❌ → Reset in onSuccess ✅

### Anti-Pattern

```tsx
// ❌ BAD: Form keeps old values after update
const updateMutation = useMutation({
  mutationFn: adminService.updateSettings,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    toast.success('Settings updated successfully');
    // Form still has old values!
  },
});
```

**Problems:**

- Form values out of sync with server
- User sees stale data
- Confusing UX

### Correct Pattern ✅

```tsx
// ✅ GOOD: Reset form to server values
const updateMutation = useMutation({
  mutationFn: adminService.updateSettings,
  onSuccess: (updatedSettings) => {
    queryClient.invalidateQueries({ queryKey: ['settings'] });

    // Sync form with server values
    setFormData(updatedSettings);
    setCorsInput(updatedSettings.cors_origins?.join(', ') || '');

    toast.success('Settings updated successfully');
  },
});
```

**Benefits:**

- Form always shows current server state
- No stale data
- Clear user feedback

---

## 3. Other Common React Anti-Patterns (To Avoid)

### ❌ Mutating State Directly

```tsx
// BAD
const items = [...state.items];
items[0] = newValue;
setState({ items }); // Reference changed but items mutated

// GOOD
setState({
  items: state.items.map((item, i) => (i === 0 ? newValue : item)),
});
```

### ❌ Using Index as Key in Dynamic Lists

```tsx
// BAD
{
  items.map((item, index) => <div key={index}>{item}</div>);
}

// GOOD
{
  items.map((item) => <div key={item.id}>{item}</div>);
}
```

### ❌ Not Memoizing Expensive Computations

```tsx
// BAD
const expensiveValue = heavyComputation(data); // Runs every render

// GOOD
const expensiveValue = useMemo(() => heavyComputation(data), [data]);
```

### ❌ Creating Functions in JSX

```tsx
// BAD (creates new function every render)
<Button onClick={() => handleClick(id)}>Click</Button>;

// GOOD
const handleButtonClick = useCallback(() => handleClick(id), [id]);
<Button onClick={handleButtonClick}>Click</Button>;
```

### ❌ Prop Drilling

```tsx
// BAD
<Parent>
  <Child data={data}>
    <GrandChild data={data}>
      <GreatGrandChild data={data} />
    </GrandChild>
  </Child>
</Parent>;

// GOOD - Use Context
const DataContext = createContext();
<DataProvider value={data}>
  <Parent>
    <Child>
      <GrandChild>
        <GreatGrandChild /> {/* Uses useContext(DataContext) */}
      </GrandChild>
    </Child>
  </Parent>
</DataProvider>;
```

---

## React Best Practices Summary

### Do ✅

1. **Use useEffect for side effects**
   - Data fetching
   - Subscriptions
   - Timers
   - DOM manipulation

2. **Keep render functions pure**
   - No side effects
   - No setState calls
   - Deterministic output

3. **Provide dependency arrays**
   - useEffect, useMemo, useCallback
   - List all dependencies
   - Use ESLint rules

4. **Use proper keys**
   - Stable identifiers (IDs)
   - Not array indices
   - Unique per list

5. **Memoize expensive operations**
   - useMemo for computations
   - useCallback for functions
   - React.memo for components

6. **Use TypeScript**
   - Catch errors at compile time
   - Better IDE support
   - Self-documenting code

### Don't ❌

1. **Never setState during render**
2. **Don't mutate state directly**
3. **Don't use index as key**
4. **Don't create functions in JSX**
5. **Don't ignore dependency warnings**
6. **Don't prop drill excessively**

---

## Testing Anti-Patterns

### Before Fix (With Anti-Pattern)

```bash
# Console shows:
Warning: Cannot update a component while rendering...
# Or infinite render loops
```

### After Fix

```bash
# Clean console, no warnings
# Predictable behavior
```

---

## Resources

- [React Docs: Rules of Hooks](https://react.dev/reference/rules)
- [React Docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Kent C. Dodds: Common Mistakes with React](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
