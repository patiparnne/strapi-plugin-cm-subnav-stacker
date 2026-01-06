/**
 * Custom Navigation Builder for Strapi v5 Content Manager
 * Creates a clean, customizable navigation for Content Manager
 */
import { PLUGIN_ID } from '../pluginId';

import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  SubNav,
  SubNavHeader,
  SubNavSection,
  SubNavSections,
  SubNavLink,
  Box,
  Typography,
  DesignSystemProvider,
  Accordion,
  Button,
  Link
} from '@strapi/design-system';
import { Permission, getFetchClient } from '@strapi/strapi/admin';

const defaultDelimiter: string = ' | ';
const defaultTemplate: Template = 'accordion';

// --- Type Definitions ---
interface ContentType {
  uid: string;
  name: string;
  displayName: string;
  group: string;
  isDisplayed: boolean;
  href: string;
  kind: 'collectionType' | 'singleType';
  sortOrder: number;
}

interface ContentTypeGroup {
  name: string;
  items: ContentType[];
  sortOrder: number;
}

type Template = 'official' | 'v5' | 'accordion';

// Extend Window interface for global state
declare global {
  interface Window {
    strapiContentTypes?: Array<ContentType>;
    strapiPermissions?: Array<Permission>;
    navObserver?: MutationObserver;
    navigationInitialized?: boolean;
    checkNavigationInterval?: number;
  }
}

// Try multiple selectors for different Strapi versions
const navQuery = 'nav[aria-label="Content Manager"]';

const getPluginConfig = async () => {
  // Try to access plugin config from window.strapi

  let delimiter = process.env.CM_SUBNAV_STACKER_DELIMITER || defaultDelimiter;
  let template = process.env.CM_SUBNAV_STACKER_TEMPLATE || defaultTemplate;

  const config = await fetch(`/cm-subnav-stacker/config`)
    .then((res) => {
      return res.json();
    })
    .catch(() => ({}));
  if (config) {
    delimiter = config.delimiter || delimiter;
    template = config.template || template;
  }

  return { delimiter, template };
};

/**
 * Converts raw content type data from Strapi API to our format
 */
const formatContentTypes = (delimiter: string, data: any): ContentType[] => {
  if (!data || !data.data) return [];

  // Calculate default sort order for items without [<number>] prefix
  const defaultSortOrder = data.data.length + 1000; // Use length + 1000 to ensure it's higher than any reasonable [<number>]

  return data.data
    .filter((ct: any) => {
      // Include both api:: content types and plugin content types (like plugin::users-permissions.user)
      return ct.uid.startsWith('api::') || ct.uid.startsWith('plugin::');
    })
    .map((ct: any) => {
      const displayName = ct.schema.displayName || ct.apiID;
      const kind = ct.schema.kind;

      // Extract sort order and clean display name, using defaultSortOrder for items without [<number>]
      const { sortOrder, cleanDisplayName } = extractSortOrder(displayName, defaultSortOrder);

      const groupName = getContentTypeGroup(delimiter, cleanDisplayName);

      // Replace the first part of cleanDisplayName with groupName
      let newDisplayName = cleanDisplayName;
      if (newDisplayName.startsWith(groupName + delimiter)) {
        newDisplayName = newDisplayName.slice((groupName + delimiter).length);
      }

      return {
        uid: ct.uid,
        name: ct.apiID,
        displayName: newDisplayName,
        group: groupName,
        isDisplayed: true,
        href: `/admin/content-manager/${kind === 'singleType'
          ? 'single-types'
          : 'collection-types'}/${ct.uid}`,
        kind,
        sortOrder
      };
    });
};

/**
 * Extracts sort order from display name
 * Looks for [<number>] pattern at the start of the display name
 * Returns the number if found, otherwise returns defaultSortOrder (typically a high number)
 */
const extractSortOrder = (displayName: string, defaultSortOrder: number = 999): { sortOrder: number; cleanDisplayName: string } => {
  const match = displayName.match(/^\[(\d+)\]\s*/);
  if (match) {
    const sortOrder = parseInt(match[1], 10);
    const cleanDisplayName = displayName.replace(/^\[\d+\]\s*/, '');
    return { sortOrder, cleanDisplayName };
  }
  return { sortOrder: defaultSortOrder, cleanDisplayName: displayName };
};

/**
 * Determines the appropriate group for a content type
 */
const getContentTypeGroup = (delimiter: string, displayName: string): string => {
  // Group mapping based on display name
  const entity = displayName.split(delimiter).map((name) => name.trim());
  return entity[0];
};

/**
 * Cleans [<number>] prefix from header text
 */
const cleanHeaderText = (text: string): string => {
  return text.replace(/^\[\d+\]\s*/, '');
};

/**
 * Sets up observer to clean header text in data-strapi-header div
 */
const setupHeaderCleaning = () => {
  const cleanHeaderElement = () => {
    const headerDiv = document.querySelector('div[data-strapi-header="true"]');
    if (headerDiv) {
      const h1Element = headerDiv.querySelector('h1');
      if (h1Element && h1Element.textContent) {
        const cleanedText = cleanHeaderText(h1Element.textContent);
        if (cleanedText !== h1Element.textContent) {
          h1Element.textContent = cleanedText;
        }
      }
    }
  };

  const cleanNavigationItems = () => {
    // Clean navigation items - find all links in the nav that go to content-manager
    let nav = document.querySelector(navQuery);
    if (!nav) {
      nav = document.querySelector('nav');
    }
    if (!nav) return;
    
    const navLinks = nav.querySelectorAll('a[href*="/admin/content-manager/"]');
    navLinks.forEach((link) => {
      // Find text content within the link (usually in a div or span)
      const textElements = link.querySelectorAll('div, span');
      textElements.forEach((element) => {
        if (element.textContent && element.textContent.match(/^\[\d+\]/)) {
          const cleanedText = cleanHeaderText(element.textContent);
          if (cleanedText !== element.textContent) {
            element.textContent = cleanedText;
          }
        }
      });
    });
  };

  // Clean immediately if header exists
  cleanHeaderElement();
  cleanNavigationItems();

  // Set up observer for dynamic header changes
  const headerObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        // Check if the mutation affects the header area
        const target = mutation.target as Element;
        if (target.nodeType === Node.ELEMENT_NODE) {
          const headerDiv = target.closest('div[data-strapi-header="true"]') ||
            target.querySelector('div[data-strapi-header="true"]');
          if (headerDiv) {
            cleanHeaderElement();
            break;
          }
          
          // Also check for navigation items
          const navItem = target.closest('a[href*="/admin/content-manager/"]') || 
                         target.querySelector('a[href*="/admin/content-manager/"]');
          if (navItem) {
            cleanNavigationItems();
            break;
          }
        }
      }
    }
  });

  // Observe the document body for header changes
  headerObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  return headerObserver;
};

/**
 * Hide Collection Types / Single Types headers and their counts
 * This is a global function that can be called from anywhere
 */
const hideCollectionTypeHeaders = () => {
  let nav = document.querySelector(navQuery);
  if (!nav) {
    nav = document.querySelector('nav');
  }
  if (!nav) return;

  // Find all spans that contain "Collection Types" or "Single Types" text
  const allSpans = nav.querySelectorAll('span');
  allSpans.forEach(span => {
    const text = span.textContent?.trim();
    if (text === 'Collection Types' || text === 'Single Types') {
      // Navigate up the DOM to find the header container
      // The structure is: span > div > div > div (header row with label + count)
      // We want to hide the div that contains both the label and the count badge
      let parent = span.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        // Check if this parent contains a sibling/child with a number (the count badge)
        const siblingWithNumber = parent.querySelector('span');
        const allSpansInParent = parent.querySelectorAll('span');
        let hasCountBadge = false;
        
        allSpansInParent.forEach(s => {
          const spanText = s.textContent?.trim();
          // Check if it's a number (count badge)
          if (spanText && /^\d+$/.test(spanText)) {
            hasCountBadge = true;
          }
        });
        
        // If this parent contains both the label text AND a count badge, hide it
        if (hasCountBadge && parent.textContent?.includes(text)) {
          // Check if this is the right level (should be a direct container, not the whole nav)
          const parentOl = parent.querySelector('ol');
          if (!parentOl) {
            // This div doesn't contain the ol list, so it's safe to hide
            (parent as HTMLElement).style.display = 'none';
            break;
          }
        }
        parent = parent.parentElement;
      }
    }
  });
};

/**
 * Organize content types into groups
 */
const organizeByGroups = (contentTypes: ContentType[]): ContentTypeGroup[] => {
  // Group content types
  const groupMap: Record<string, ContentType[]> = {};

  contentTypes.forEach(contentType => {
    const groupName = contentType.group || 'General';
    if (!groupMap[groupName]) {
      groupMap[groupName] = [];
    }
    groupMap[groupName].push(contentType);
  });

  // Sort items within groups by sortOrder first, then alphabetically
  Object.values(groupMap).forEach(items => {
    items.sort((a, b) => {
      // First sort by sortOrder (ascending: 0, 1, 2, etc.)
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      // If sortOrder is the same, sort alphabetically by displayName
      return a.displayName.localeCompare(b.displayName);
    });
  });

  // Convert to array and calculate group sort orders
  const groups = Object.entries(groupMap).map(([name, items]) => {
    // Calculate group sort order based on minimum sortOrder within the group
    const minSortOrder = Math.min(...items.map(item => item.sortOrder));

    return {
      name,
      items,
      sortOrder: minSortOrder
    };
  });

  // Sort groups by their sort order first, then alphabetically
  // Keep "General" at the top if it exists
  groups.sort((a, b) => {
    if (a.name === 'General') return -1;
    if (b.name === 'General') return 1;

    // First sort by group sortOrder (ascending: 0, 1, 2, etc.)
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    // If sortOrder is the same, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  return groups;
};

/**
 * Main Official Navigation Component
 */
const OfficialNavigation: React.FC<{ groups: ContentTypeGroup[] }> = ({ groups }) => {
  return (
    <Box background="neutral100">
      <SubNav aria-label="Content Manager" style={{ background: 'transparent', height: 'auto' }}>
        <SubNavHeader label="All" />
        <SubNavSections>
          {groups.map((group) => (
            <OfficialContentTypeGroupSection key={group.name} group={group} />
          ))}
        </SubNavSections>
      </SubNav>
    </Box>
  );
};
const OfficialContentTypeGroupSection: React.FC<{ group: ContentTypeGroup }> = ({ group }) => {
  // Skip empty groups
  if (group.items.length === 0) return null;

  // Group by kind (collection types and single types)
  const collectionTypes = group.items.filter(item => item.kind === 'collectionType');
  const singleTypes = group.items.filter(item => item.kind === 'singleType');
  const allTypes = [...collectionTypes, ...singleTypes];
  return (
    <SubNavSection label={group.name} collapsable>
      {allTypes.map((item) => (
        <OfficialContentTypeLink key={item.uid} contentType={item} />
      ))}
    </SubNavSection>
  );
};
const OfficialContentTypeLink: React.FC<{ contentType: ContentType }> = ({ contentType }) => {
  const isActive = window.location.pathname.includes(contentType.uid);

  return (
    <SubNavLink
      href={contentType.href}
      active={isActive}
      style={{ background: 'transparent' }}
      className={isActive ? 'active' : ''}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        // Use React Router navigation if available
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', contentType.href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = contentType.href;
        }
      }}
    >
      {contentType.displayName}
    </SubNavLink>
  );
};

/**
 * Strapi 5 Official Navigation Component
 */
const V5Navigation: React.FC<{ groups: ContentTypeGroup[] }> = ({ groups }) => {
  return (
    <div style={{
      gap: 8,
      alignItems: 'stretch',
      flexDirection: 'column',
      display: 'flex'
    }}>
      <div style={{
        paddingInlineStart: '20px',
        paddingInlineEnd: '20px',
      }}>
        <div style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: 'row',
          display: 'flex'
        }}>
          <div style={{
            alignItems: 'center',
            flexDirection: 'row',
            display: 'flex'
          }}>
            <div>
              <span style={{
                fontWeight: 600,
                fontSize: '1.1rem',
                lineHeight: 1.45,
                textTransform: 'uppercase',
                color: '#666687'
              }}>
                All
              </span>
            </div>
          </div>
        </div>
      </div>
      <ol
        style={{
          gap: 2,
          alignItems: 'stretch',
          flexDirection: 'column',
          display: 'flex',
          marginInlineStart: 8,
          marginInlineEnd: 8,
        }}
      >
        {groups.map((group, index) => (
          <V5ContentTypeGroupSection key={`${group.name}-${index}`} group={group} />
        ))}
      </ol>
    </div>
  );
};
const V5ContentTypeGroupSection: React.FC<{ group: ContentTypeGroup }> = ({ group }) => {
  // Skip empty groups
  if (group.items.length === 0) return null;

  // Group by kind (collection types and single types)
  const collectionTypes = group.items.filter(item => item.kind === 'collectionType');
  const singleTypes = group.items.filter(item => item.kind === 'singleType');
  const allTypes = [...collectionTypes, ...singleTypes];

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    allTypes.some(item => window.location.pathname.includes(item.uid)) && setExpanded(true);
  }, []);

  return (
    allTypes.length === 1
      ? <V5ContentTypeLink key={`${allTypes[0].uid}-0`} contentType={allTypes[0]} asMain />
      : (
        <li>
          <div>
            <div
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
                flexDirection: 'row',
                display: 'flex'
              }}
            >
              <button
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  border: 'none',
                  padding: 0,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  height: 32,
                  borderRadius: 4,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                }}
                className={`${expanded ? 'expanded' : ''}`}
                onClick={() => setExpanded(!expanded)}
              >
                <div style={{
                  width: '100%',
                  textAlign: 'left',
                  paddingInlineEnd: '8px',
                }}>
                  <span style={{
                    fontSize: '1.4rem',
                    lineHeight: '1.43',
                    color: '#32324d',
                    fontWeight: 500
                  }}>
                    {group.name}
                  </span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 32 32"
                  width={16}
                  height={16}
                  fill="#8e8ea9"
                  aria-hidden="true"
                  style={{
                    transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.5s'
                  }}
                >
                  <path d="m27.061 13.061-10 10a1.503 1.503 0 0 1-2.125 0l-10-10a1.503 1.503 0 1 1 2.125-2.125L16 19.875l8.939-8.94a1.502 1.502 0 1 1 2.125 2.125z" />
                </svg>
              </button>
            </div>
          </div>
          <ul
            style={{
              gap: 2,
              alignItems: 'stretch',
              flexDirection: 'column',
              display: 'flex',
              maxHeight: expanded ? 1000 : 0,
              overflow: 'hidden',
              transition: expanded
                ? 'max-height 1s ease-in-out'
                : 'max-height 0.5s cubic-bezier(0, 1, 0, 1)',
            }}
            className={`custom-nav-group-items ${expanded ? 'expanded' : ''}`}
          >
            {allTypes.map((item, index) => (
              <V5ContentTypeLink key={`${item.uid}-${index}`} contentType={item} />
            ))}
          </ul>
        </li>
      )
  );
};
const V5ContentTypeLink: React.FC<{ contentType: ContentType, asMain?: boolean }> = ({ contentType, asMain }) => {
  const isActive = window.location.pathname.includes(contentType.uid);

  return (
    <li>
      <Link
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textDecoration: 'none',
          height: 32,
          color: isActive ? '#271fe0' : '#32324d',
          backgroundColor: isActive ? '#f0f0ff' : 'transparent',
          fontWeight: isActive ? 500 : 'normal',
          borderRadius: '4px'
        }}
        className={`custom-nav-item ${isActive ? 'active' : ''}`}
        href={contentType.href}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          // Use React Router navigation if available
          if (window.history && window.history.pushState) {
            window.history.pushState({}, '', contentType.href);
            window.dispatchEvent(new PopStateEvent('popstate'));
          } else {
            window.location.href = contentType.href;
          }
        }}
      >
        <div style={{
          paddingLeft: asMain ? '12px' : '24px',
        }}>
          <div
            style={{
              gap: 4,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexDirection: 'row',
              display: 'flex',
            }}
          >
            <div style={{
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              fontSize: '1.4rem',
              lineHeight: '1.43',
              color: isActive ? '#271fe0' : '#32324d',
              fontWeight: asMain ? 500 : 'normal',
            }}>
              {contentType.displayName}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
};

/**
 * Accordion Navigation Component
 */
const AccordionNavigation: React.FC<{ groups: ContentTypeGroup[] }> = ({ groups }) => {

  const value = groups.find(
    group => group.items.find(item => window.location.pathname.includes(item.uid))
  )?.name;

  return (
    <Box>
      <Accordion.Root
        defaultValue={value}
        style={{ border: 'none', borderRadius: 0 }}
      >
        {groups.map((group) => (
          <AccordionContentTypeGroupSection key={group.name} group={group} />
        ))}
      </Accordion.Root>
    </Box>
  );
};
const AccordionContentTypeGroupSection: React.FC<{ group: ContentTypeGroup }> = ({ group }) => {
  // Skip empty groups
  if (group.items.length === 0) return null;

  // Group by kind (collection types and single types)
  const collectionTypes = group.items.filter(item => item.kind === 'collectionType');
  const singleTypes = group.items.filter(item => item.kind === 'singleType');
  const allTypes = [...collectionTypes, ...singleTypes];

  return (
    <Accordion.Item
      key={group.name}
      value={`${group.name}`}
      style={{ border: 'none', borderRadius: 0 }}
    >
      <Accordion.Header>
        <Accordion.Trigger>{group.name}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        {allTypes.map((item) => (
          <AccordionContentTypeLink key={item.uid} contentType={item} />
        ))}
      </Accordion.Content>
    </Accordion.Item>
  );
};
const AccordionContentTypeLink: React.FC<{ contentType: ContentType }> = ({ contentType }) => {
  const isActive = window.location.pathname.includes(contentType.uid);

  return (
    <Link href={contentType.href}
      style={{ textDecoration: 'none', display: 'block' }}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        // Use React Router navigation if available
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', contentType.href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = contentType.href;
        }
      }}
    >
      <Button variant={isActive ? 'secondary' : 'ghost'}
        fullWidth
        size="L"
        style={
          {
            paddingLeft: 56,
            justifyContent: 'start',
            borderRadius: 0,
            borderLeft: 'none',
            borderRight: 'none',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }
        }

      >
        {contentType.displayName}
      </Button>
    </Link>
  );
};

/**
 * Root Navigation Application
 */
const NavigationApp: React.FC = () => {
  const [groups, setGroups] = useState<ContentTypeGroup[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  const [isSearching, setIsSearching] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);

  const initialize = async () => {

    const { delimiter, template } = await getPluginConfig();

    setTemplate(template as Template);
    console.log(`Building Navigation with delimiter "${delimiter}" and template "${template}"`);

    async function fetchAdminPermissions(): Promise<Permission[]> {
      try {
        // Use Strapi's built-in fetch client which handles auth automatically
        const { get } = getFetchClient();
        const { data } = await get('/admin/users/me/permissions');

        console.log(data);
        
        // accept both array and {data: ...}
        const list = Array.isArray(data) ? data : (data?.data ?? data?.permissions ?? []);
        // Store for future use
        window.strapiPermissions = list;
        console.log('Successfully fetched permissions:', list.length);
        return list;
      } catch (error) {
        console.error('Error fetching permissions with getFetchClient:', error);
        // Return empty array - the caller will use fallback behavior
        return [];
      }
    }

    // Fetch content types on component mount
    const fetchContentTypes = async () => {
      try {
        console.log('Fetching content types from API...');
        // Use Strapi's fetch client which handles auth automatically
        const { get } = getFetchClient();
        const response = await get('/content-type-builder/content-types');
        console.log('Raw API response:', response);
        console.log('response.data:', response.data);
        
        // Handle different response structures
        // getFetchClient returns { data: ... } where data could be the array directly or { data: [...] }
        let rawData = response.data;
        if (rawData && !Array.isArray(rawData) && rawData.data) {
          // Structure is { data: { data: [...] } }
          rawData = rawData.data;
        }
        
        const contentTypes = formatContentTypes(delimiter, { data: rawData });
        console.log('Formatted content types:', contentTypes.length, contentTypes);

        let permissions: Permission[] = window.strapiPermissions || [];

        if (!permissions || permissions.length === 0) {
          console.log('Fetching permissions...');
          permissions = await fetchAdminPermissions();
        }
        console.log('Permissions:', permissions.length);

        let allowedContentTypes: ContentType[];
        
        // If we have permissions, filter by them; otherwise show all content types
        // (fallback for when permission fetch fails in production)
        if (permissions.length > 0) {
          allowedContentTypes = contentTypes.filter((ct) => {
            // Check for standard content-manager read permissions
            const hasContentManagerRead = permissions.some(
              (p) => p.action === 'plugin::content-manager.explorer.read' && p.subject === ct.uid
            );
            
            // For plugin content types (like plugin::users-permissions.user),
            // also check for any read action that includes the content type UID
            const isPluginContentType = ct.uid.startsWith('plugin::');
            const hasPluginRead = isPluginContentType && permissions.some(
              (p) => p.subject === ct.uid && (
                p.action?.includes('read') || 
                p.action?.includes('find') ||
                p.action === 'plugin::content-manager.explorer.read'
              )
            );
            
            return hasContentManagerRead || hasPluginRead;
          });
          console.log('Allowed content types after permission filter:', allowedContentTypes.length, allowedContentTypes);
        } else {
          // Fallback: show all content types when permissions can't be fetched
          console.warn('No permissions available, showing all content types as fallback');
          allowedContentTypes = contentTypes;
        }

        // Store for future use
        window.strapiContentTypes = allowedContentTypes;

        // Organize into groups
        const groups = organizeByGroups(allowedContentTypes);
        console.log('Organized groups:', groups);
        setGroups(groups);
      } catch (error) {
        console.error('Error fetching content types:', error);
      }
    };

    // Use cached content types or fetch new ones
    if (window.strapiContentTypes && window.strapiContentTypes.length > 0) {
      console.log('Using cached content types:', window.strapiContentTypes.length);
      const groups = organizeByGroups(window.strapiContentTypes);
      console.log('Groups from cache:', groups);
      setGroups(groups);
    } else {
      console.log('No cached content types, fetching...');
      fetchContentTypes();
    }
  };

  // Update path when it changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Add event listener for page navigation
    window.addEventListener('popstate', handleLocationChange);

    // Check for path changes regularly
    const pathCheckInterval = setInterval(() => {
      if (window.location.pathname !== currentPath) {
        handleLocationChange();
      }
    }, 100);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      clearInterval(pathCheckInterval);
    };
  }, [currentPath]);

  // Fetch content types and set up navigation
  useEffect(() => {

    initialize();

    // Function to hide Collection Types / Single Types headers and counts
    const hideCollectionHeaders = (hide: boolean = true) => {
      let nav = document.querySelector(navQuery);
      if (!nav) {
        nav = document.querySelector('nav');
      }
      if (!nav) return;

      // Find all spans that contain "Collection Types" or "Single Types" text
      const allSpans = nav.querySelectorAll('span');
      allSpans.forEach(span => {
        const text = span.textContent?.trim();
        if (text === 'Collection Types' || text === 'Single Types') {
          // Find the parent container (usually a few levels up) and hide it
          // The structure is: div > div > div > span, we want to hide the outermost div
          let parent = span.parentElement;
          // Go up until we find the div that contains the header row
          for (let i = 0; i < 5 && parent; i++) {
            if (parent.classList.contains('hvPsis') || 
                (parent.tagName === 'DIV' && parent.querySelector('span')?.textContent?.match(/^\d+$/))) {
              (parent as HTMLElement).style.display = hide ? 'none' : '';
              break;
            }
            parent = parent.parentElement;
          }
        }
      });
    };

    // Initial hide of headers
    hideCollectionHeaders(true);

    const toggleIsSearching = (isSearching: boolean) => {
      // Find all navigation ol elements and their direct li children
      let nav = document.querySelector(navQuery);
      if (!nav) {
        nav = document.querySelector('nav');
      }
      if (!nav) return;
      
      const allOls = nav.querySelectorAll('ol');
      const otherNavs: Element[] = [];
      
      allOls.forEach(ol => {
        const liChildren = Array.from(ol.children).filter(
          el => el.tagName === 'LI' && el.id !== 'stack-nav-container'
        );
        otherNavs.push(...liChildren);
      });
      
      console.log('toggleIsSearching called with:', isSearching, 'Found other nav items:', otherNavs.length);
      
      setIsSearching(isSearching);
      if (isSearching) {
        // When searching, show the original Strapi navigation and headers
        otherNavs.forEach(nav => {
          (nav as HTMLElement).style.display = 'initial';
        });
        hideCollectionHeaders(false); // Show headers when searching
      } else {
        // When not searching, hide the original Strapi navigation and headers
        otherNavs.forEach(nav => {
          (nav as HTMLElement).style.display = 'none';
        });
        hideCollectionHeaders(true); // Hide headers when not searching
      }
      
      // Also toggle visibility of our custom navigation items
      const customNavContainer = document.getElementById('stack-nav-container');
      if (customNavContainer) {
        const customNavItems = customNavContainer.querySelectorAll('li');
        console.log('Found custom nav items to toggle:', customNavItems.length);
        customNavItems.forEach(item => {
          if (isSearching) {
            // Hide custom nav when searching
            (item as HTMLElement).style.display = 'none';
          } else {
            // Show custom nav when not searching
            (item as HTMLElement).style.display = '';
          }
        });
      }
    };

    // Create a function to check the search input
    const checkSearchInput = () => {
      if (window.location.pathname === currentPath) {
        const searchNav = document.querySelector(`${navQuery} input`);
        if (searchNav) {
          const value = (searchNav as HTMLInputElement).value;
          toggleIsSearching(!!value);
          return searchNav;
        } else {
          toggleIsSearching(false);
          return null;
        }
      }
      return null;
    };

    // Initial check
    const searchInput = checkSearchInput();

    // Set up input observer to watch for value changes
    let inputObserver: MutationObserver | null = null;

    if (searchInput) {
      // For immediate value changes when typing
      searchInput.addEventListener('input', () => {
        const value = (searchInput as HTMLInputElement).value;
        toggleIsSearching(!!value);
      });

      // For programmatic changes to the input
      inputObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
            const value = (searchInput as HTMLInputElement).value;
            toggleIsSearching(!!value);
          }
        });
      });

      inputObserver.observe(searchInput, {
        attributes: true,
        attributeFilter: ['value']
      });
    }

    // Set up DOM observer to find the search input when it appears
    const navObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const searchInput = checkSearchInput();
          if (searchInput && !inputObserver) {
            // Set up the input observer on the newly found element
            searchInput.addEventListener('input', () => {
              const value = (searchInput as HTMLInputElement).value;
              toggleIsSearching(!!value);
            });

            inputObserver = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                  const value = (searchInput as HTMLInputElement).value;
                  toggleIsSearching(!!value);
                }
              });
            });

            inputObserver.observe(searchInput, {
              attributes: true,
              attributeFilter: ['value']
            });

            break;
          }
        }
      }
    });

    // Start observing the document body for the nav to appear
    navObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      if (inputObserver) {
        inputObserver.disconnect();
      }
      navObserver.disconnect();
    };
  }, []);

  console.log('NavigationApp render - groups:', groups.length, 'isSearching:', isSearching, 'template:', template);

  if (groups.length === 0) {
    console.log('No groups to display, returning null');
    return null;
  }

  return !isSearching ? (
    <DesignSystemProvider>
      {
        template === 'accordion' ? (
          <AccordionNavigation groups={groups} />
        ) : template === 'v5' ? (
          <V5Navigation groups={groups} />
        ) : (
          <OfficialNavigation groups={groups} />
        )
      }
    </DesignSystemProvider>
  ) : <></>;
};

/**
 * Main function to build stacked navigation
 * (Called from app.tsx bootstrap)
 */
export async function buildNavigation(): Promise<void> {
  console.log('Building stacked navigation...');

  try {
    // This function is executed once during the bootstrap phase
    // We'll use it to initialize the event listeners for page navigation
    if (typeof window !== 'undefined') {
      // Initial setup (will be managed by setupContinuousNavigationCheck later)
      setupNavigationReplacement();

      // Set up header text cleaning
      setupHeaderCleaning();

      // Ensure the window object is initialized
      window.navigationInitialized = window.navigationInitialized || false;

      // Make the function available on window for debugging
      (window as any).reinitializeNavigation = () => {
        setupNavigationReplacement();
      };
    }
  } catch (error) {
    console.error('Error building custom navigation:', error);
  }
}

/**
 * Set up DOM observer to replace the default navigation
 */
const setupNavigationReplacement = () => {
  // Skip if already observing
  if (window.navObserver) {
    window.navObserver.disconnect();
    window.navObserver = undefined;
  }

  console.log('Setting up navigation observer...');

  // Function to handle when navigation is found
  const processNavigation = (originalNav: Element) => {
    console.log('Found Content Manager navigation', originalNav);

    // Check if our custom navigation is already present
    const existingNav = document.getElementById('stack-nav-container');
    if (existingNav) {
      console.log('Custom navigation already exists');
      // If it exists but has no children, re-render
      if (existingNav.children.length === 0) {
        const root = ReactDOM.createRoot(existingNav);
        root.render(<NavigationApp />);
      }
      return;
    }

    // Create container for custom navigation
    const navContainer = document.createElement('li');
    navContainer.id = 'stack-nav-container';
    navContainer.className = 'stack-navigation';

    // Add our custom navigation to the DOM
    originalNav.prepend(navContainer);

    console.log('Custom navigation container added, rendering React app...');

    // Render our React application
    const root = ReactDOM.createRoot(navContainer);
    root.render(<NavigationApp />);
  };

  // Try to find navigation immediately
  // Try multiple strategies to find the nav element
  let nav = document.querySelector(navQuery);
  console.log('Looking for nav element with aria-label:', navQuery, 'Found:', !!nav);
  
  // Fallback 1: Try any nav in the content manager
  if (!nav) {
    nav = document.querySelector('nav');
    console.log('Fallback: Looking for any nav element, Found:', !!nav);
  }
  
  // Fallback 2: Look for a nav that contains Collection Types or Single Types text
  if (!nav) {
    const allNavs = Array.from(document.querySelectorAll('nav'));
    nav = allNavs.find(n => {
      const text = n.textContent || '';
      return text.includes('Collection Types') || text.includes('Single Types');
    }) || null;
    console.log('Fallback: Looking for nav with Collection Types text, Found:', !!nav);
  }
  
  if (nav) {
    // In v5.28.0, the structure is deeply nested
    // Find the main ol that wraps all content types (not the sub-ols for Collection/Single Types)
    const allOls = Array.from(nav.querySelectorAll('ol'));
    console.log('Found', allOls.length, 'ol elements in nav');
    
    // The main ol is the one that contains li elements with Collection Types/Single Types
    // It should be the first/top-level ol
    const mainOl = allOls.find(ol => {
      const hasStack = ol.querySelector('#stack-nav-container');
      const hasCollectionTypes = ol.textContent?.includes('Collection Types');
      const hasSingleTypes = ol.textContent?.includes('Single Types');
      // If it already has our container, it's the right one
      if (hasStack) return true;
      // Otherwise, it should contain the Collection/Single Types sections
      return (hasCollectionTypes || hasSingleTypes) && ol.parentElement?.closest('ol') === null;
    });
    
    console.log('Found main ol:', !!mainOl);
    
    if (mainOl) {
      processNavigation(mainOl);
      return;
    }
    
    // Fallback: try the first ol
    if (allOls.length > 0) {
      console.log('Fallback: using first ol element');
      processNavigation(allOls[0]);
      return;
    }
  }
  
  console.log('Navigation not found yet - will retry via observer');
};

// Check if the plugin is enabled by attempting to fetch its config endpoint.
// If the server-side plugin is disabled, this endpoint won't exist (404).
const isPluginEnabled = async (): Promise<boolean> => {
  try {
    const response = await fetch('/cm-subnav-stacker/config');
    return response.ok;
  } catch {
    return false;
  }
};

// Set up continuous navigation check (only runs if plugin is enabled)
const setupContinuousNavigationCheck = () => {
  // Only set up once
  if (window.navigationInitialized) return;

  // Mark as initialized
  window.navigationInitialized = true;

  // Set up the initial observer
  setupNavigationReplacement();

  // Set up header cleaning
  setupHeaderCleaning();

  // Set up an interval to check for navigation changes
  if (!window.checkNavigationInterval) {
    window.checkNavigationInterval = window.setInterval(() => {
      // Check if we're on a content manager page
      if (window.location.pathname.includes('/admin/content-manager')) {
        // Look for nav element with multiple fallbacks
        let navElement = document.querySelector(navQuery);
        if (!navElement) {
          navElement = document.querySelector('nav');
        }
        if (!navElement) {
          const allNavs = Array.from(document.querySelectorAll('nav'));
          navElement = allNavs.find(n => {
            const text = n.textContent || '';
            return text.includes('Collection Types') || text.includes('Single Types');
          }) || null;
        }
        
        // Find the main ol (the top-level one that should contain our custom nav)
        let navContainer = null;
        if (navElement) {
          const allOls = Array.from(navElement.querySelectorAll('ol'));
          // Find the main ol - it should contain Collection Types or have our container
          navContainer = allOls.find(ol => {
            const hasStack = ol.querySelector('#stack-nav-container');
            const hasCollectionTypes = ol.textContent?.includes('Collection Types');
            return hasStack || (hasCollectionTypes && ol.parentElement?.closest('ol') === null);
          }) || allOls[0] || null;
        }
        
        const customNav = document.getElementById('stack-nav-container');

        // If we have a navigation container but no custom nav, set it up
        if (navContainer && !customNav) {
          console.log('Navigation detected without custom navigation, reinitializing...');
          setupNavigationReplacement();
        }

        // Hide Collection Types / Single Types headers
        hideCollectionTypeHeaders();

        // Also ensure header cleaning is active
        const headerDiv = document.querySelector('div[data-strapi-header="true"]');
        if (headerDiv) {
          const h1Element = headerDiv.querySelector('h1');
          if (h1Element && h1Element.textContent && h1Element.textContent.match(/^\[\d+\]/)) {
            const cleanedText = cleanHeaderText(h1Element.textContent);
            h1Element.textContent = cleanedText;
          }
        }
      }
    }, 100); // Check every 100ms
  }
};

// Initialize on load (client-side only) - but only if plugin is enabled
if (typeof window !== 'undefined') {
  // Check if plugin is enabled before initializing
  isPluginEnabled().then((enabled) => {
    if (enabled) {
      console.log('✅ cm-subnav-stacker is enabled, initializing navigation...');
      setupContinuousNavigationCheck();
    } else {
      console.log('⏸️ cm-subnav-stacker is disabled, skipping initialization.');
    }
  });
}

export default NavigationApp;
