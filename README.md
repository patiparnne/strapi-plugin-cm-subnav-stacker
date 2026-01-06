# cm-subnav-stacker

Automatically groups related content types in the Strapi Content Manager sidebar into collapsible subnavigation sections based on name patterns.

## Installation

Install the plugin via npm:

```bash
npm install strapi-plugin-cm-subnav-stacker
```

Then enable the plugin in your `config/plugins.ts` (see Configuration section below).

## Features

- Automatically organizes content types with common prefixes/patterns into grouped sections
- Configurable delimiter for parsing content type names
- Multiple UI template options for different visual styles
- Seamless integration with Strapi v5 Content Manager

## Configuration

Add the plugin to your `config/plugins.ts`:

```typescript
'cm-subnav-stacker': {
  enabled: true,
  config: {
    delimiter: env(
      'CM_SUBNAV_STACKER_DELIMITER',
      ' | '
    ),
    template: env(
      'CM_SUBNAV_STACKER_TEMPLATE',
      'v5'
    ),
  }
},
```

### Configuration Options

#### `delimiter`

**Type:** `string`  
**Default:** `' | '`

The string used to separate the grouping subject from its items in content type names.

**Example:**
- Content types named `Product | Category`, `Product | Family`, `Product | Component` will be grouped under "Product"
- The delimiter `' | '` splits the name to determine the group

#### `template`

**Type:** `'accordion' | 'official' | 'v5'`  
**Default:** `'v5'`

The UI template style for displaying grouped navigation items.

**Available Templates:**

- **`accordion`** - Uses Strapi Design System accordion styling with expandable/collapsible sections
- **`official`** - Uses the official Strapi navigation style
- **`v5`** - Respects Strapi v5 subnavigation styling (recommended)

## Usage

Once configured, the plugin will automatically detect content types that share common prefixes (based on your delimiter) and group them into collapsible sections in the Content Manager sidebar.

### Naming Convention

Structure your content type names using the delimiter pattern:

```
GroupName | ItemName
```

**Examples:**
- `Blog | Post`
- `Blog | Category`
- `Blog | Tag`
- `Product | Category`
- `Product | Subcategory`

These will be automatically grouped under "Blog" and "Product" respectively.

#### Ordering

To control the order of items within a group, prefix the title with `[<number>]`:

```
GroupName | [<number>] ItemName
```

**Examples:**
- `[1] Blog | Category`
- `[2] Blog | Post`
- `[3] Blog | Tag`

Items will be sorted numerically based on the number prefix within each group.

## Environment Variables

You can configure the plugin using environment variables in your `.env` file:

```env
CM_SUBNAV_STACKER_DELIMITER=" | "
CM_SUBNAV_STACKER_TEMPLATE=v5
```
