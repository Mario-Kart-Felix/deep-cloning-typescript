import { Sidebars } from '../../config.js'
import { VirtualModule } from '../types.js'
import Markdown from '../../markdown/index.js'
import context from '../../context.js'
import { Config } from '../../config'
import path from 'path'

interface ResolvedSidebar {
  title: string
  routePath?: string
  children?: ResolvedSidebar[]
}

interface ParsedMarkdown {
  title: string
  routePath?: string
  transformedPaths: string[]
}

function notNullableGuard<T>(value: T): value is NonNullable<T> {
  return value !== null
}

const resolveSidebarConfig = (
  markdowns: Markdown[],
  config: Config
): ResolvedSidebar[] => {
  const { sidebars, root } = config
  if (sidebars) {
    const parse = (sidebars: Sidebars): ResolvedSidebar[] => {
      return sidebars
        .map((o) => {
          if (typeof o === 'string') {
            const filePath = path.join(root, o)
            const target = markdowns.find((o) => o.fullPath === filePath)
            if (!target) {
              return null
            }
            return {
              title: target?.title,
              routePath: target?.routePath
            }
          } else {
            return {
              title: o.title,
              children: parse(o.children)
            }
          }
        })
        .filter(notNullableGuard)
    }
    return parse(sidebars)
  } else {
    const parsed: ParsedMarkdown[] = markdowns.map((o) => {
      return {
        title: o.title,
        routePath: o.routePath,
        transformedPaths: o.routePath.split('/').filter((o) => o !== '')
      }
    })

    let root: ResolvedSidebar = {
      title: 'ROOT',
      children: []
    }

    function parse(
      markdowns: ParsedMarkdown[],
      node: ResolvedSidebar
    ): ResolvedSidebar[] {
      let mapper: {
        [key: string]: ParsedMarkdown[]
      } = {}

      markdowns.forEach((markdown) => {
        const path = markdown.transformedPaths
        if (!path[0]) {
          return
        }
        if (mapper[path[0]]) {
          mapper[path[0]].push({
            ...markdown,
            transformedPaths: path.slice(1)
          })
        } else {
          mapper[path[0]] = [
            {
              ...markdown,
              transformedPaths: path.slice(1)
            }
          ]
        }
      })

      const tmp = Object.entries(mapper).map(([key, value]) => {
        if (value.length === 1 && value[0].transformedPaths.length === 0) {
          return {
            title: value[0].title,
            routePath: value[0].routePath
          }
        }

        const tmp: ResolvedSidebar = {
          title: key,
          routePath: key,
          children: []
        }
        tmp.children = parse(value, tmp)
        return tmp
      })

      node.children = tmp
      return tmp
    }

    return parse(parsed, root)
  }
}

const Sidebars = (): VirtualModule => {
  const markdowns = context.get('markdowns') as Markdown[]
  const config = context.get('config') as Config
  const sidebarsConfig = resolveSidebarConfig(markdowns, config)

  const content = `
    export const sidebars = ${JSON.stringify(sidebarsConfig)};
  `

  return {
    moduleName: '@docit/sidebars',
    moduleContent: content
  }
}

export default Sidebars
