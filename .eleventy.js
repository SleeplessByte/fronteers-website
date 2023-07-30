const glob = require('fast-glob');
const lodash = require('lodash');
const slugify = require('slugify');

const { EleventyRenderPlugin } = require('@11ty/eleventy');
const EleventyPluginIds = require('@orchidjs/eleventy-plugin-ids');
const EleventyVitePlugin = require('@11ty/eleventy-plugin-vite');
const EleventyPluginRss = require('@11ty/eleventy-plugin-rss');
const EleventyPluginSyntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');

/**
 * Get all unique key values from a collection
 *
 * @param {Array} collectionArray - collection to loop through
 * @param {String} key - key to get values from
 */
function getAllKeyValues(collectionArray, key) {
  // get all values from collection
  let allValues = collectionArray.map((post) => {
    let values = post.data[key] ? post.data[key] : [];
    return values;
  });

  // flatten values array
  allValues = lodash.flattenDeep(allValues);
  // to lowercase
  allValues = allValues.map((post) => post.toLowerCase());
  // remove duplicates
  allValues = [...new Set(allValues)];
  // order alphabetically
  allValues = allValues.sort(function (a, b) {
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
  });
  // return
  return allValues;
}

/**
 * Transform a string into a slug
 * Uses slugify package
 *
 * @param {String} str - string to slugify
 */
function strToSlug(str) {
  const options = {
    replacement: '-',
    remove: /[&,+()$~%.'":*?<>{}]/g,
    lower: true,
  };

  return slugify(str, options);
}

module.exports = function (eleventyConfig) {
  const quick = Boolean(process.env.BUILD_QUICK);
  const now = new Date();

  // There is a quick build function (npm run start:quick) that only loads the
  // recent content (YTD and previous year), by excluding all year folders from
  // older content. We process this first so that any plugin doesn't even see
  // these files.
  if (quick) {
    glob
      .sync(
        'src/{nl,en}/{activiteiten,activities,blog,congres,conference,werk-en-freelance}/**/*.md'
      )
      .forEach((file) => {
        const parts = file.split('/');

        let year = Number(parts[parts.length - 3]);
        if (isNaN(year)) {
          // Sometimes there is no "month" directory
          year = Number(parts[parts.length - 2]);
          if (isNaN(year)) {
            return;
          }
        }

        if (year >= now.getFullYear() - 1) {
          return;
        }

        eleventyConfig.ignores.add(file);
        console.debug('[ignore] ', file);
      });

    eleventyConfig.ignores.add('src/nl/vereniging/bestuur/notulen');
  }

  /* Copy static assets to the dist directory */
  eleventyConfig.setServerPassthroughCopyBehavior('copy');
  eleventyConfig.addPassthroughCopy('_redirects');
  eleventyConfig.addPassthroughCopy('public');

  /* Copy files for asset pipeline */
  eleventyConfig.addPassthroughCopy('src/assets/css');
  eleventyConfig.addPassthroughCopy('src/assets/js');

  glob.sync('src/{_components,_includes}/**/*.css').forEach((file) => {
    const input = String(file).split('/').slice(0, -1).join('/');
    const output = input.replace(/^src\//, 'assets/');

    const mapping = {};
    mapping[`${input}/*.css`] = output;
    eleventyConfig.addPassthroughCopy(mapping);
  });

  // Enable renderTemplate and renderFile
  eleventyConfig.addPlugin(EleventyRenderPlugin);

  // Add id to heading elements
  eleventyConfig.addPlugin(EleventyPluginIds);

  // Enable asset bundling
  eleventyConfig.addPlugin(EleventyVitePlugin, {
    tempFolderName: '.11ty-vite',

    viteOptions: {
      publicDir: 'public',
      clearScreen: false,
      server: {
        mode: 'development',
        middlewareMode: true,
      },
      appType: 'custom',
      assetsInclude: ['**/*.xml', '**/*.txt'],
      build: {
        mode: 'production',
        sourcemap: 'true',
        manifest: true,
        rollupOptions: {
          output: {
            assetFileNames: 'assets/css/main.[hash].css',
            chunkFileNames: 'assets/js/[name].[hash].js',
            entryFileNames: 'assets/js/[name].[hash].js',
          },
        },
      },
    },
  });

  // Add RSS feed for blog
  eleventyConfig.addPlugin(EleventyPluginRss);

  // Add Syntax highlighting to code blocks
  eleventyConfig.addPlugin(EleventyPluginSyntaxHighlight);

  // Rebuild when any of the files are changed, but exclude css because that is
  // handled by the asset pipeline.
  //
  eleventyConfig.addWatchTarget('./src/');

  /* Load all paired shortcodes */
  glob.sync('src/_components/paired/**/*.js').forEach((file) => {
    const exports = require(`./${file}`);
    Object.entries(exports).forEach(([name, shortcode]) => {
      eleventyConfig.addPairedShortcode(name, shortcode);
      console.debug(`[shortcode] ${name} (paired)`);
    });
  });

  /* Load all shortcodes */
  glob.sync('src/_components/shortcodes/**/*.js').forEach((file) => {
    const exports = require(`./${file}`);
    Object.entries(exports).forEach(([name, shortcode]) => {
      eleventyConfig.addShortcode(name, shortcode);
      console.debug(`[shortcode] ${name}`);
    });
  });

  eleventyConfig.addCollection('canonical', function (collection) {
    return collection
      .getFilteredByTag('pages')
      .filter((post) => Boolean(post.data.key))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(post.data.locale == 'nl'));
  });

  eleventyConfig.addCollection('published_posts', function (collection) {
    return collection
      .getFilteredByTag('posts')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .reverse();
  });

  eleventyConfig.addCollection('published_posts_nl', function (collection) {
    return collection
      .getFilteredByTag('posts')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .filter((post) => Boolean(post.data.locale == 'nl'))
      .reverse();
  });

  eleventyConfig.addCollection('published_posts_en', function (collection) {
    return collection
      .getFilteredByTag('posts')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .filter((post) => Boolean(post.data.locale == 'en'))
      .reverse();
  });

  eleventyConfig.addCollection('published_activities', function (collection) {
    return collection
      .getFilteredByTag('activities')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .sort((a, b) => b.data.eventdate - a.data.eventdate);
  });

  eleventyConfig.addCollection(
    'published_activities_nl',
    function (collection) {
      return collection
        .getFilteredByTag('activities')
        .filter((post) => Boolean(!post.data.draft))
        .filter((post) => Boolean(!post.data.excludeFromCollection))
        .filter((post) => Boolean(post.date <= now))
        .filter((post) => Boolean(!post.data.parent))
        .filter((post) => Boolean(post.data.locale == 'nl'))
        .sort((a, b) => b.data.eventdate - a.data.eventdate);
    }
  );

  eleventyConfig.addCollection(
    'published_activities_en',
    function (collection) {
      return collection
        .getFilteredByTag('activities')
        .filter((post) => Boolean(!post.data.draft))
        .filter((post) => Boolean(!post.data.excludeFromCollection))
        .filter((post) => Boolean(post.date <= now))
        .filter((post) => Boolean(!post.data.parent))
        .filter((post) => Boolean(post.data.locale == 'en'))
        .sort((a, b) => b.data.eventdate - a.data.eventdate);
    }
  );

  eleventyConfig.addCollection('published_jobs', function (collection) {
    return collection
      .getFilteredByTag('jobs')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .reverse();
  });

  eleventyConfig.addCollection('published_jobs_nl', function (collection) {
    return collection
      .getFilteredByTag('jobs')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .filter((post) => Boolean(post.data.locale == 'nl'))
      .reverse();
  });

  eleventyConfig.addCollection('published_jobs_en', function (collection) {
    return collection
      .getFilteredByTag('jobs')
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.parent))
      .filter((post) => Boolean(post.data.locale == 'en'))
      .reverse();
  });

  eleventyConfig.addCollection('published_members', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(!post.data.draft));
  });

  eleventyConfig.addCollection('published_members_nl', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.data.locale == 'nl'));
  });

  eleventyConfig.addCollection('published_members_en', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.draft))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.data.locale == 'en'));
  });

  eleventyConfig.addCollection('freelancers', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(post.data.freelancer))
      .filter((post) => Boolean(!post.data.draft));
  });

  eleventyConfig.addCollection('freelancers_nl', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.data.freelancer))
      .filter((post) => Boolean(post.data.locale == 'nl'))
      .filter((post) => Boolean(!post.data.draft));
  });

  eleventyConfig.addCollection('freelancers_en', function (collection) {
    return collection
      .getFilteredByTag('members')
      .filter((post) => Boolean(post.date <= now))
      .filter((post) => Boolean(!post.data.excludeFromCollection))
      .filter((post) => Boolean(post.data.freelancer))
      .filter((post) => Boolean(post.data.locale == 'en'))
      .filter((post) => Boolean(!post.data.draft));
  });

  eleventyConfig.addCollection('drafts', function (collection) {
    return collection.getAll().filter((post) => Boolean(post.data.draft));
  });

  eleventyConfig.addCollection('memberSpecialties', function (collection) {
    let allSpecialties = getAllKeyValues(
      collection
        .getFilteredByTag('members')
        .filter((post) => Boolean(post.data.freelancer)),
      'specialties'
    );

    let memberSpecialties = allSpecialties.map((category) => ({
      title: category,
      slug: strToSlug(category),
    }));

    return memberSpecialties;
  });

  eleventyConfig.addCollection('activityCategories', function (collection) {
    let allCategories = getAllKeyValues(
      collection.getFilteredByTag('activities'),
      'categories'
    );

    let eventCategories = allCategories.map((category) => ({
      title: category,
      slug: strToSlug(category),
    }));

    return eventCategories;
  });

  eleventyConfig.addCollection('blogCategories', function (collection) {
    let allCategories = getAllKeyValues(
      collection.getFilteredByTag('posts'),
      'categories'
    );

    let blogCategories = allCategories.map((category) => ({
      title: category,
      slug: strToSlug(category),
    }));

    return blogCategories;
  });

  eleventyConfig.addCollection('jobCategories', function (collection) {
    let allCategories = getAllKeyValues(
      collection.getFilteredByTag('jobs'),
      'categories'
    );

    let jobCategories = allCategories.map((category) => ({
      title: category,
      slug: strToSlug(category),
    }));

    return jobCategories;
  });

  eleventyConfig.addFilter('getLocale', function (collection, locale) {
    return collection.filter((post) => Boolean(post.data.locale == locale));
  });

  eleventyConfig.addFilter('slugify', function (string) {
    return strToSlug(string);
  });

  eleventyConfig.addFilter('displayDate', function (date, locale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
  });

  eleventyConfig.setLiquidOptions({
    dynamicPartials: true,
    strictFilters: false,
  });

  /* All templates in the content directory are parsed and copied to the dist directory */
  return {
    // templateFormats: ['md', 'njk', 'html', 'liquid'],
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
      layouts: '_layouts',
      data: '_data',
    },
  };
};
