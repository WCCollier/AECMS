# Comment & Review UI — Implementation Proposal

**Status**: Backend complete. Frontend not yet built.
**For review**: Describes the proposed UI components to implement in a future session.

---

## Background

The backend comment/review system (unified since Phase 9) supports:
- Plain comments on articles and products (login required)
- Rated reviews on articles and products (login + verified purchase for products)
- Nested replies (one level deep)
- One review per user per item (enforced server-side)
- AI moderation (auto-approve / flag / spam)
- `ratings: CommentRating[]` on each comment — first entry must be `title: "Overall", value: 1–5`

---

## Components Needed

### 1. `StarInput` — interactive star rating selector

**Location**: `frontend/components/comments/StarInput.tsx`

**Props**:
```ts
interface StarInputProps {
  value: number;       // 0 = unset
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}
```

**Behavior**: 5 clickable stars; hover previews; keyboard accessible (arrow keys). Renders gold fill up to selected value, outline for the rest.

---

### 2. `CommentForm` — post a new comment or review

**Location**: `frontend/components/comments/CommentForm.tsx`

**Props**:
```ts
interface CommentFormProps {
  articleId?: string;
  productId?: string;
  parentId?: string;          // set for replies — hides rating input
  isProduct?: boolean;        // true = show review fields if user is verified purchaser
  verifiedPurchase?: boolean; // passed from parent after checking order history
  onSuccess: () => void;      // triggers SWR mutate on parent
}
```

**Fields**:
| Field | Condition | Notes |
|-------|-----------|-------|
| Review title (`title`) | `isProduct && verifiedPurchase && !parentId` | Optional headline |
| Overall rating (`StarInput`) | `isProduct && verifiedPurchase && !parentId` | Required for reviews |
| Comment body (`content`) | Always | Min 10 chars |
| Submit button | Always | Disabled while loading |

**Behavior**:
- If `isProduct && !verifiedPurchase`: show "You must purchase this product to leave a review. You can still ask a question." and omit the review fields, posting as a plain comment.
- On submit: `POST /comments` with `{ article_id?, product_id?, parent_id?, title?, content, ratings: [{ title: 'Overall', value }] }`.
- On 409 (duplicate review): show "You've already reviewed this item. Edit your existing review instead."

---

### 3. `CommentCard` — renders a single comment or review

**Location**: `frontend/components/comments/CommentCard.tsx`

**Props**:
```ts
interface CommentCardProps {
  comment: Comment;
  onReplySuccess: () => void;
}
```

**Layout**:
```
[Avatar initial] [Display name]  [date]   [Verified Purchase badge if true]
                 [★★★★☆ 4.2]  ← Overall rating, if review
                 [Review title]  ← if present
                 [Comment content]
                 [Reply link]
                 ↳ [nested replies, non-collapsible, max 1 level]
```

**Verified Purchase badge**: small green checkmark chip "Verified Purchase".

**Reply link**: clicking opens an inline `CommentForm` with `parentId` set. No rating fields on replies.

---

### 4. `CommentList` — fetches and renders all comments for an article/product

**Location**: `frontend/components/comments/CommentList.tsx`

**Props**:
```ts
interface CommentListProps {
  articleId?: string;
  productId?: string;
  verifiedPurchase?: boolean;  // passed in from product/article page after auth check
}
```

**Data**: SWR fetch from `GET /comments/article/:id` or `GET /comments/product/:id`.

**Layout**:
```
─────────────────────────────────────────
Reviews (N)        Average: ★★★★☆ 4.2
─────────────────────────────────────────
[CommentForm]   ← always shown if logged in; collapses after submit
─────────────────────────────────────────
[CommentCard]
[CommentCard]
[CommentCard]
[Load more]     ← pagination, not infinite scroll (comments are scanned linearly)
```

**If not logged in**: replace CommentForm with "Sign in to leave a comment."

---

### 5. Integration points

**Article detail page** (`frontend/app/(site)/latest/[slug]/ArticlePageClient.tsx`):

Below the article body, add:
```tsx
<CommentList articleId={article.id} />
```

No verified-purchase check needed for articles — any logged-in user can comment.

**Product detail page** (`frontend/app/(site)/shop/[slug]/ProductPageClient.tsx`):

After the product info card, add:
```tsx
<CommentList
  productId={product.id}
  verifiedPurchase={verifiedPurchase}
/>
```

Where `verifiedPurchase` is determined by:
```ts
// Call GET /orders/my and check if any order item matches product.id
const { orders } = useOrders();
const verifiedPurchase = orders.some(
  (o) => ['processing', 'completed'].includes(o.status) &&
    o.items.some((i) => i.product_id === product.id)
);
```

---

## API Calls Reference

| Action | Endpoint |
|--------|----------|
| List article comments | `GET /comments/article/:articleId?page=1&limit=20` |
| List product comments | `GET /comments/product/:productId?page=1&limit=20` |
| Post comment/review | `POST /comments` |
| Edit comment/review | `PATCH /comments/:id` |
| Delete own comment | `DELETE /comments/:id` |

---

## Out of Scope for This Proposal

- Admin moderation UI (approve/reject/spam) — separate admin-panel feature
- Edit/delete UX on existing comments (needs inline edit state in `CommentCard`)
- Pagination of replies (one level deep, replies are never paginated)
- Rich text in comments (plain text only for now)

---

## Implementation Order (when you're ready)

1. `StarInput` — self-contained, no dependencies
2. `CommentForm` — depends on `StarInput`
3. `CommentCard` — depends on `CommentForm` (for inline reply)
4. `CommentList` — assembles the above
5. Wire into article detail page
6. Wire into product detail page (add verified-purchase check)
